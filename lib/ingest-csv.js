'use strict'

const _ = require('lodash')
const get = require('lodash.get')
const csv = require('fast-csv')
const AWS = require('aws-sdk')
const queue = require('async.queue')
const es = require('./es')
const zlib = require('zlib')

var esClient
const got = require('got')
const stream = require('stream')

const s3 = new AWS.S3()

const index = 'items'

// split a CSV to multiple files and trigger lambdas 
function split(url, bucket, prefix, arn='', maxFiles=0, linesPerFile=500, maxLambdas=20, reverse=false, cb=null) {

  let fileCounter = 0
  let lineCounter = 0
  const lineBuffer = new Buffer(4096)
  const gunzip = zlib.createGunzip()
  let newStream
  let currentFile
  let lineLength = 0
  let stopSplitting = false
  let header

  switch (url.substr(url.lastIndexOf('.') + 1)) {
    case 'csv':
      newStream = got.stream(url)
      break
    case 'gz':
      newStream = got.stream(url).pipe(gunzip)
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
      const fileName = `${prefix}_${fileCounter}.csv`;
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
      if ((fileCounter >= maxFiles) && maxFiles != 0 && !reverse) {
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
          Key: `${prefix}_${fileCounter}.csv`
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
        invokeLambda(bucket, key, startFile, Math.min(endFile, maxEndFile), arn)
        startFile = endFile + 1
      }
    }
    cb()
  })
  newStream.on('error', e => cb(e))
}


// Process 1 or more CSV files by processing one at a time, then invoking the next
function processFiles(bucket, key, transform, cb, currentFileNum=0, lastFileNum=0, arn=null, retries=0) {
  const maxRetries = 10

  var nextFileNum = (currentFileNum < lastFileNum) ? currentFileNum + 1 : null
  //invokeLambda(bucket, key, currentFileNum, lastFileNum, arn)

  processFile(
    bucket, `${key}_${currentFileNum}.csv`, transform
  ).then((n_scenes) => {
    invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, 0)
    cb()
  }).catch((e) => {
    // if CSV failed, try it again
    if (retries < maxRetries) {
      invokeLambda(bucket, key, currentFileNum, lastFileNum, arn, retries + 1)
    } else {
      // log and move onto the next one
      console.log(`error: maxRetries hit in file ${currentFileNum}`)
      invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, 0)
    }
    cb()
  })
}


// Process single CSV file
function processFile(bucket, key, transform) {
  // get the csv file s3://${bucket}/${key}
  const s3 = new AWS.S3()
  console.log('processFile', bucket, key)
  const csvStream = csv.parse({ headers: true, objectMode: true })
  s3.getObject({Bucket: bucket, Key: key}).createReadStream().pipe(csvStream)
  return es.streamToEs(csvStream, transform, esClient, index)
}


// kick off processing next CSV file
function invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, retries) {
    // figure out if there's a next file to process
    if (nextFileNum && arn) {
      const stepfunctions = new AWS.StepFunctions()
      const params = {
        stateMachineArn: arn,
        input: JSON.stringify({ bucket, key, currentFileNum: nextFileNum, lastFileNum, arn, retries}),
        name: `csv_${nextFileNum}_${Date.now()}`
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


//async function update(event, transform, cb) {
async function update(bucket, key, transform, cb, currentFileNum=0, lastFileNum=0, arn=null, retries=0) {
  //const bucket = _.get(event, 'bucket')
  //const key = _.get(event, 'key')
  //const currentFileNum = _.get(event, 'currentFileNum', 0)
  //const lastFileNum = _.get(event, 'lastFileNum', 0)
  //const arn = _.get(event, 'arn', null)
  //const retries = _.get(event, 'retries', 0)

  es.client().then((client) => {
    esClient = client
    es.putMapping(client, index).catch((err) => {})
    processFiles(bucket, key, transform, cb, currentFileNum, lastFileNum, arn, retries)
  }).catch((err) => {console.log(err)})
}


module.exports = {
  update: update,
  split: split
}
