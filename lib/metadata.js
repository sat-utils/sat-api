'use strict'

const _ = require('lodash')
const get = require('lodash.get')
const csv = require('fast-csv')
const AWS = require('aws-sdk')
const queue = require('async.queue')
const es = require('./es')
const zlib = require('zlib')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const pump = require('pump')
let esClient
const got = require('got')
const stream = require('stream')

const s3 = new AWS.S3()

const index = process.env.ES_INDEX || 'items'


function streamToEs(stream, transform, type='sat', id='id') {
  // Given an input stream and a transform, write records to an elasticsearch instance

  var n_records = 0
  var n_csv = 0
  var n_transformed = 0

  var toEs = through2({'objectMode': true, 'consume': true}, function(data, encoding, next) {
    var record = {
      index: index,
      type: type, 
      id: data['id'],
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

  var esStream = new ElasticsearchWritableStream(esClient, {
    highWaterMark: 100,
    flushTimeout: 1000
  })

  return new Promise((resolve, reject) => {
    pump(stream, transform, toEs, esStream, function(err) {
        console.log('stream done', err)
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
    toEs.on('data', (data) => {n_transformed++})
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
      }
      stepfunctions.startExecution(params, function(err, data) {
        if (err) {
          console.log(err, err.stack)
        } else {
          console.log(`launched ${JSON.stringify(params)}`)
        }
      }) 
    }
}


// Process 1 or more CSV files by processing one at a time, then invoking the next
function processCsvFiles(bucket, key, satellite, transform, cb, currentFileNum=0, lastFileNum=0, arn=null, retries=0) {
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


function invokeLambda2(satellite, firstFileNum, lastFileNum, arn, cb) {
  const stepfunctions = new AWS.StepFunctions()
  const prefix = process.env.prefix || 'sat-api-dev'
  if (firstFileNum > lastFileNum) return
  const inputs = {
    bucket: process.env.bucket || 'sat-api',
    key: `${prefix}/csv/${satellite}`,
    satellite,
    currentFileNum: firstFileNum,
    lastFileNum,
    arn
  }
  const params = {
    stateMachineArn: arn,
    input: JSON.stringify(inputs),
    name: `csv_${satellite}_${firstFileNum}_${Date.now()}`
  }
  stepfunctions.startExecution(params, function(err, data) {
    console.log(`${params.name} step function launched: ${JSON.stringify(inputs)}`);
    if (err) console.log(`step function launch error: ${err}`)
  })
}


function split(satellite, arn, maxFiles, linesPerFile, maxLambdas, cb) {

  let fileCounter = 0
  let lineCounter = 0
  linesPerFile = linesPerFile || 500
  maxLambdas = maxLambdas || 20
  maxFiles = maxFiles || 0
  arn = arn || ''

  const bucket = process.env.bucket || 'sat-api'
  const prefix = process.env.prefix || 'sat-api-dev'

  const lineBuffer = new Buffer(4096)
  const gunzip = zlib.createGunzip()
  let remoteCsv
  let newStream
  let currentFile
  let lineLength = 0
  let stopSplitting = false
  let header
  let reverse = false

  switch (satellite) {
    case 'landsat':
      remoteCsv = 'https://landsat.usgs.gov/landsat/metadata_service/bulk_metadata_files/LANDSAT_8_C1.csv'
      newStream = got.stream(remoteCsv)
      break
    case 'sentinel':
      remoteCsv = 'https://storage.googleapis.com/gcp-public-data-sentinel-2/index.csv.gz'
      reverse = true
      newStream = got.stream(remoteCsv).pipe(gunzip)
      break
  }

  const build = function buildFile(line) {
    // get the csv header
    if (fileCounter === 0 && lineCounter === 0) header = line.toString()

    // create a new file or add to existing
    if (lineCounter === 0) {
      currentFile = new stream.PassThrough()
      currentFile.push(header)
    } else {
      currentFile.push(line.toString())
    }
    lineCounter += 1 // increment the filename
    lineLength = 0 // reset the buffer

    if (lineCounter > linesPerFile) {
      fileCounter += 1
      const fileName = `${prefix}/csv/${satellite}/${satellite}_${fileCounter}.csv`;
      const params = {
        Body: currentFile,
        Bucket: bucket,
        Key: fileName
      }
      currentFile.end()
      s3.upload(params, (e, d) => { if (e) console.log(e) })
      lineCounter = 0 // start counting the lines again
      if ((fileCounter) % 250 === 0 && fileCounter != 0) console.log(`uploaded ${fileCounter} files`)
      // sentinel csv is ordered from old to new so always have to go all the way back
      if ((fileCounter >= maxFiles) && maxFiles != 0 && satellite != 'sentinel') {
        stopSplitting = true
      }
    }
  }

  newStream.on('data', (data) => {
    if (!stopSplitting) {
      const dataLen = data.length
      for (let i = 0; i < dataLen; i++) {
        lineBuffer[lineLength] = data[i] // Buffer new line data.
        lineLength++
        if (data[i] === 10) { // Newline char was found.
          build(lineBuffer.slice(0, lineLength))
        }
      }
    }
  })

  newStream.on('end', () => {
    // write the last records
    if (lineCounter > 0) {
        fileCounter += 1
        const params = {
          Body: currentFile,
          Bucket: bucket,
          Key: `${prefix}/csv/${satellite}/${satellite}_${fileCounter}.csv`
        }
        s3.upload(params, (e, d) => { if (e) console.log(e) })
        currentFile.end()
    }
    console.log(`${fileCounter} total files`)
    // determine batches and run lambdas
    if (arn != '') {
      maxFiles = (maxFiles === 0) ? fileCounter : Math.min(maxFiles, fileCounter)
      var numLambdas = Math.min(maxFiles, maxLambdas)
      var batchSize = Math.floor(maxFiles / numLambdas)
      var extra = maxFiles % numLambdas
      var maxEndFile = reverse ? fileCounter : maxFiles
      
      var startFile = reverse ? fileCounter - maxFiles + 1: 1
      var endFile
      console.log(`Invoking ${numLambdas} batches of Lambdas of ${batchSize} files each with ${extra} extra (Files ${startFile}-${maxEndFile})`)
      for (var i = 0; i < numLambdas; i++) {
        endFile = (i < extra) ? startFile + batchSize: startFile + batchSize - 1
        invokeLambda2(satellite, startFile, Math.min(endFile, maxEndFile), arn)
        startFile = endFile + 1
      }
    }
    cb()
  })
  newStream.on('error', e => cb(e))
}


function update(event, transform, cb) {
  const bucket = _.get(event, 'bucket')
  const key = _.get(event, 'key')
  const sat = _.get(event, 'satellite', 'landsat')
  const currentFileNum = _.get(event, 'currentFileNum', 0)
  const lastFileNum = _.get(event, 'lastFileNum', 0)
  const arn = _.get(event, 'arn', null)
  const retries = _.get(event, 'retries', 0)

  if (!esClient) {
    es.connect().then((client) => {
      esClient = client
      es.putMapping(esClient, index).catch((err) => {})
      processCsvFiles(bucket, key, sat, transform, cb, currentFileNum, lastFileNum, arn, retries)
    }).catch(err => {
      console.log(err)
    })
  }
  else {
    processCsvFiles(bucket, key, sat, transform, cb, currentFileNum, lastFileNum, arn, retries)
  }
}


module.exports = {
  update: update,
  split: split
}
