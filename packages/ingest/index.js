'use strict'

const got = require('got')
const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')


// SNS message
module.exports.handler = function handler(event) {
  const msg = JSON.parse(event.Records[0].Sns.Message)
  console.log('ingest message: ', JSON.stringify(msg))
  let url
  msg.Records.forEach((val) => {
    url = `https://${val.s3.bucket.name}.s3.amazonaws.com/${val.s3.object.key}`

    got(url, { json: true }).then((data) => {
      // create input stream from collection record
      const inStream = new readableStream.Readable({ objectMode: true })
      console.log(data.body)
      inStream.push(data.body)
      inStream.push(null)
      return satlib.es.stream(inStream)
    }).catch((err) => {
      console.log(`Error ingesting: ${err}`)
    })
  })
}
