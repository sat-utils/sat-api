'use strict'

const csv = require('fast-csv')
const AWS = require('aws-sdk')
const zlib = require('zlib')
const es = require('./es')

const got = require('got')
const stream = require('stream')

const s3 = new AWS.S3()

const index = 'items'

// kick off processing next CSV file
function invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, retries) {
  // figure out if there's a next file to process
  if (nextFileNum && arn) {
    const stepfunctions = new AWS.StepFunctions()
    const params = {
      stateMachineArn: arn,
      input: JSON.stringify({
        bucket, key, currentFileNum: nextFileNum, lastFileNum, arn, retries
      }),
      name: `ingest_${nextFileNum}_${Date.now()}`
    }
    return stepfunctions.startExecution(params, (err) => {
      if (err) {
        console.log(err, err.stack)
      }
      else {
        console.log(`launched ${JSON.stringify(params)}`)
      }
    })
  }
  return 0
}

// split a CSV to multiple files and trigger lambdas
function split({
  url,
  bucket,
  key,
  arn = '',
  inMaxFiles = 0,
  linesPerFile = 500,
  maxLambdas = 20,
  reverse = false,
  cb = null
}) {
  let maxFiles = inMaxFiles
  let fileCounter = 0
  let lineCounter = 0
  const lineBuffer = Buffer.alloc(4096)
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
  default:
    return cb('case not found')
  }

  const build = function buildFile(line) {
    // get the csv header
    if (fileCounter === 0 && lineCounter === 0) header = line.toString()

    // create a new file or add to existing
    if (lineCounter === 0) {
      currentFile = new stream.PassThrough()
      currentFile.push(header)
    }
    else {
      currentFile.push(line.toString())
    }
    lineCounter += 1 // increment the filename
    lineLength = 0 // reset the buffer

    if (lineCounter > linesPerFile) {
      fileCounter += 1
      const fileName = `${key}${fileCounter}.csv`
      const params = {
        Body: currentFile,
        Bucket: bucket,
        Key: fileName
      }
      currentFile.end()
      s3.upload(params, (e) => {
        if (e) console.log(e)
      })
      lineCounter = 0 // start counting the lines again
      if ((fileCounter) % 250 === 0 && fileCounter !== 0) {
        console.log(`uploaded ${fileCounter} files`)
      }
      // sentinel csv is ordered from old to new so always have to go all the way back
      if ((fileCounter >= maxFiles) && maxFiles !== 0 && !reverse) {
        stopSplitting = true
      }
    }
  }

  newStream.on('data', (data) => {
    if (!stopSplitting) {
      const dataLen = data.length
      for (let i = 0; i < dataLen; i += 1) {
        lineBuffer[lineLength] = data[i] // Buffer new line data.
        lineLength += 1
        if (data[i] === 10) { // Newline char was found.
          build(lineBuffer.slice(0, lineLength))
        }
      }
    }
  })

  newStream.on('error', (e) => cb(e))

  return newStream.on('end', () => {
    // write the last records
    if (lineCounter > 0) {
      fileCounter += 1
      const params = {
        Body: currentFile,
        Bucket: bucket,
        Key: `${key}${fileCounter}.csv`
      }
      s3.upload(params, (e) => {
        if (e) console.log(e)
      })
      currentFile.end()
    }
    console.log(`${fileCounter - 1} total files`)
    // determine batches and run lambdas
    if (arn !== '') {
      maxFiles = (maxFiles === 0) ? fileCounter : Math.min(maxFiles, fileCounter)
      const numLambdas = Math.min(maxFiles, maxLambdas)
      const batchSize = Math.floor(maxFiles / numLambdas)
      const extra = maxFiles % numLambdas
      const maxEndFile = reverse ? fileCounter : maxFiles

      let startFile = reverse ? (fileCounter - maxFiles) + 1 : 1
      let endFile
      console.log(
        `Invoking ${numLambdas} batches of Lambdas of ${batchSize} files each with ` +
        `${extra} extra (Files ${startFile}-${maxEndFile})`
      )

      for (let i = 0; i < numLambdas; i += 1) {
        endFile = (i < extra) ? (startFile + batchSize) : ((startFile + batchSize) - 1)
        invokeLambda(bucket, key, startFile, Math.min(endFile, maxEndFile), arn)
        startFile = endFile + 1
      }
    }
    cb()
  })
}


// Process 1 or more CSV files by processing one at a time, then invoking the next
function processFiles({
  bucket,
  key,
  transform,
  currentFileNum = 0,
  lastFileNum = 0,
  arn = null,
  retries = 0
}) {
  const maxRetries = 5
  const nextFileNum = (currentFileNum < lastFileNum) ? currentFileNum + 1 : null

  // CSV stream from file
  const csvStream = csv.parse({ headers: true, objectMode: true })
  key = `${key}${currentFileNum}.csv`
  s3.getObject({ Bucket: bucket, Key: key }).createReadStream().pipe(csvStream)

  console.log(`Processing s3://${bucket}/${key}`)

  return es.stream(csvStream, transform, index)
    .then(() => {
      invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, 0)
    }).catch(() => {
      // if CSV failed, try it again
      if (retries < maxRetries) {
        invokeLambda(bucket, key, currentFileNum, lastFileNum, arn, retries + 1)
      }
      else {
        // log and move onto the next one
        console.log(`error: maxRetries hit in file ${currentFileNum}`)
        invokeLambda(bucket, key, nextFileNum, lastFileNum, arn, 0)
      }
    })
}


module.exports = {
  split: split,
  processFiles: processFiles
}
