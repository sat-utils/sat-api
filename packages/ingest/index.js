'use strict'

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
    satlib.ingest.ingest(url)
  })
}
