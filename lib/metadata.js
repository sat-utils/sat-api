'use strict'

const _ = require('lodash')
const get = require('lodash.get')
const csv = require('fast-csv')
const AWS = require('aws-sdk')
const queue = require('async.queue')
const es = require('./es')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const pump = require('pump')
let esClient;


/*var WritableBulk = require('elasticsearch-streams').WritableBulk;
var TransformToBulk = require('elasticsearch-streams').TransformToBulk;
var bulkExec = function(bulkCmds, callback) {
  client.bulk({
    index : process.env.ES_INDEX,
    type  : 'sat',
    body  : bulkCmds
  }, callback);
};*/

function uniques(array) {
   return Array.from(new Set(array));
}


function streamToEs(stream, transform, index=process.env.ES_INDEX, type='sat', id='scene_id') {
  // Given an input stream and a transform, write records to an elasticsearch instance

  var n_records = 0
  var n_csv = 0
  var n_transformed = 0

  var toEs = through2({'objectMode': true, 'consume': true}, function(data, encoding, next) {
    var record = {
      index: index,
      type: type, 
      id: data[id],
      action: 'update',
      _retry_on_conflict: 3,
      body: {
        doc: data,
        doc_as_upsert: true
      }
    }
    this.push(record)
    next()
  })

  const s3 = new AWS.S3()
  const csvStream = csv.parse({ headers: true, objectMode: true })
  s3.getObject({Bucket: bucket, Key: key}).createReadStream().pipe(csvStream)

  var esStream = new ElasticsearchWritableStream(esClient, {
    highWaterMark: 100,
    flushTimeout: 1000
  })

  return new Promise((resolve, reject) => {
    pump(stream, transform, toEs, esStream, function(err) {
          if (err) {
            console.log('error:', err)
            reject(n_transformed)
          } else {
            console.log(`Finished: ${n_records} csv records, ${n_transformed} transformed, `)
            resolve(n_transformed)
          }
        })

    // count records
    stream.on('data', (data) => {n_records++})
    transform.on('data', (data) => {
      n_csv++
    })
    toEs.on('data', (data) => {n_transformed++})

    //toBulk.on('data', (data) => {n_transformed++})
    //ws.on('close', console.log(`Closed: ${n_records} records, ${n_transformed} transformed`))
  })
}


function processCsvFile(bucket, key, transform) {
  // get the csv file s3://${bucket}/${key}
 
  const s3 = new AWS.S3()
  const csvStream = csv.parse({ headers: true, objectMode: true })
  s3.getObject({Bucket: bucket, Key: key}).createReadStream().pipe(csvStream)

  return streamToEs(csvStream, transform)
}


// kick off processing next CSV file
function invokeLambda(bucket, key, satellite, nextFileNum, lastFileNum, arn, retries) {
    // figure out if there's a next file to process
    
    if (nextFileNum && arn) {
      const stepfunctions = new AWS.StepFunctions()
      const params = {
        stateMachineArn: arn,
        input: JSON.stringify({ bucket, key, satellite, currentFileNum: nextFileNum, lastFileNum, arn, retries}),
        name: `csv_${satellite}_${nextFileNum}_${Date.now()}`
      };
      stepfunctions.startExecution(params, function(err, data) {
        if (err) {
          console.log(err, err.stack)
        } else {
          console.log(`launched ${JSON.stringify(params)}`)
        }
      }) 
    }
}


function prepare(event, transform, cb) {
  const bucket = _.get(event, 'bucket')
  const key = _.get(event, 'key')
  const satellite = _.get(event, 'satellite', 'landsat')
  const currentFileNum = _.get(event, 'currentFileNum', 0)
  const lastFileNum = _.get(event, 'lastFileNum', 0)
  const arn = _.get(event, 'arn', null)
  var retries = _.get(event, 'retries', 0)
  const maxRetries = 10

  const currentKey = `${key}/${satellite}_${currentFileNum}.csv`;
  var nextFileNum = (currentFileNum < lastFileNum) ? currentFileNum + 1 : null
  //invokeLambda(bucket, key, satellite, currentFileNum, lastFileNum, arn)

  processCsvFile(
    bucket, currentKey, transform
  ).then((n_scenes) => {
    invokeLambda(bucket, key, satellite, nextFileNum, lastFileNum, arn, 0)
    cb()
  }).catch((e) => {
    // if CSV failed, try it again
    if (retries < maxRetries) {
      invokeLambda(bucket, key, satellite, currentFileNum, lastFileNum, arn, retries + 1)
    } else {
      // log and move onto the next one
      console.log(`error: maxRetries hit in file ${currentFileNum}`)
      invokeLambda(bucket, key, satellite, nextFileNum, lastFileNum, arn, 0)
    }
    cb()
  })
}

function update(event, transform, cb) {
  if (!esClient) {
    es.connect().then((client) => {
      esClient = client;
      es.putMapping(esClient, process.env.ES_INDEX).catch(() => {})
      prepare(event, transform, cb)
    })
  }
  else {
    prepare(event, transform, cb)
  }
}

module.exports.update = update
