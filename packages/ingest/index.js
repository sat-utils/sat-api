'use strict'

const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')

// SNS message
module.exports.handler = function handler(event) {
  const msg = JSON.parse(event.Records[0].Sns.Message)
  console.log('ingest message: ', JSON.stringify(msg))
  let url
  if (msg.hasOwnProperty('Records')) {
    msg.Records.forEach((val) => {
      // msg is link to updated file
      url = `https://${val.s3.bucket.name}.s3.amazonaws.com/${val.s3.object.key}`
      satlib.ingest.ingest(url)
    })
  } else if (msg.hasOwnProperty('catalog')) {
    satlib.ingest.ingest(msg.catalog)
  } else {
    // msg is STAC record itself
    const inStream = new readableStream.Readable({ objectMode: true })
    inStream.push(msg)
    inStream.push(null)
    satlib.es.stream(inStream)
  }
}
