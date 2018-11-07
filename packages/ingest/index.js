'use strict'
const got = require('got')
const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')


// SNS message
module.exports.handler = function handler(event, context, cb) {
  console.log('ingest event: ', JSON.stringify(event))
  const msg = JSON.parse(event.Records[0].Sns.Message)
  console.log(msg)
  let url
  msg.Records.forEach((val) => {
    url = `https://${val.s3.bucket.name}.s3.amazonaws.com/${val.s3.object.key}`
    console.log(`ingesting ${url}`)

    got(url, { json: true }).then((data) => {
      // create input stream from collection record
      const inStream = new readableStream.Readable({ objectMode: true })
      inStream.push(data)
      inStream.push(null)
      return satlib.es.stream(inStream)
    })

  })
}
