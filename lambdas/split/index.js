'use strict'

const got = require('got')
const stream = require('stream')
const AWS = require('aws-sdk')
const zlib = require('zlib')
const local = require('kes/src/local')

const stepfunctions = new AWS.StepFunctions()
const s3 = new AWS.S3()


function invokeLambda(satellite, firstFileNum, lastFileNum, arn, cb) {
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
    const fileName = `${prefix}/csv/${satellite}/${satellite}_${fileCounter}.csv`;

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
      const params = {
        Body: currentFile,
        Bucket: bucket,
        Key: fileName
      };
      currentFile.end();
      s3.upload(params, (e, d) => { if (e) console.log(e) })
      lineCounter = 0 // start counting the lines again
      if ((fileCounter) % 250 === 0 && fileCounter != 0) console.log(`uploaded ${fileCounter + 1} files`)
      fileCounter += 1

      // sentinel csv is ordered from old to new so always have to go all the way back
      if ((fileCounter >= maxFiles) && maxFiles != 0 && satellite != 'sentinel') {
        stopSplitting = true
      }
    }
  }

  newStream.on('data', (data) => {
    if (!stopSplitting) {
      const dataLen = data.length;
      for (let i = 0; i < dataLen; i++) {
        lineBuffer[lineLength] = data[i] // Buffer new line data.
        lineLength++;
        if (data[i] === 10) { // Newline char was found.
          build(lineBuffer.slice(0, lineLength))
        }
      }
    }
  })

  newStream.on('end', () => {
    // write the last records
    if (lineCounter > 0) {
        const params = {
          Body: currentFile,
          Bucket: bucket,
          Key: `${prefix}/csv/${satellite}/${satellite}_${fileCounter}.csv`
        };
        s3.upload(params, (e, d) => { if (e) console.log(e) })
        currentFile.end();
    }
    console.log(`${fileCounter} total files`)
    // determine batches and run lambdas
    if (arn != '') {
      maxFiles = (maxFiles === 0) ? fileCounter : maxFiles
      var numLambdas = Math.min(maxFiles, maxLambdas)
      var batchSize = Math.floor(maxFiles / numLambdas)
      var extra = maxFiles % numLambdas
      var maxEndFile = reverse ? fileCounter - 1 : maxFiles - 1
      
      var startFile = reverse ? fileCounter - maxFiles : 0
      var endFile
      console.log(`Invoking ${numLambdas} batches of Lambdas up to ${batchSize} each (Files ${startFile}-${maxEndFile})`)
      for (var i = 0; i < numLambdas; i++) {
        endFile = (i < extra) ? startFile + batchSize: startFile + batchSize - 1
        invokeLambda(satellite, startFile, Math.min(endFile, maxEndFile), arn)
        startFile = endFile + 1
      }
    }
    cb()
  })
  newStream.on('error', e => cb(e))
}

module.exports.handler = function (event, context, cb) {
  split(event.satellite, event.arn, event.maxFiles, event.linesPerFile, event.maxLambdas, cb)
}

local.localRun(() => {
  const payload = {
    satellite: 'landsat',
    arn: '',
    maxFiles: 1,
  }

  module.exports.handler(payload, null, (e, r) => {
    console.log(e, r)
  })
})
