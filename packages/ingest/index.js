'use strict'

const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')
const taskStarter = require('@developmentseed/task-starter/src')

// SNS message
module.exports.handler = function handler(event) {
  console.log('Ingest message: ', JSON.stringify(event))
  let url

  // event is SNS message of updated file on s3
  if (event.hasOwnProperty('Records')) {
    const msg = JSON.parse(event.Records[0].Sns.Message)
    msg.Records.forEach((val) => {
      // msg is link to updated file
      url = `https://${val.s3.bucket.name}.s3.amazonaws.com/${val.s3.object.key}`
      console.log(`Ingesting ${url}`)
      satlib.ingest.ingest(url)
    })
  // event is a STAC Item
  } else if (event.hasOwnProperty('type' === 'Feature')) {
    // event is STAC record itself
    console.log('Ingesting a STAC Item')
    const inStream = new readableStream.Readable({ objectMode: true })
    inStream.push(event)
    inStream.push(null)
    satlib.es.stream(inStream)
  // event is URL to a catalog node
  } else if (event.hasOwnProperty('url')) {
    const recursive = event.recursive || true
    const collectionsOnly = event.collectionsOnly || false
    console.log(`Ingesting URL ${event.url}`)
    satlib.ingest.ingest(event.url, recursive, collectionsOnly)
  } else if (event.hasOwnProperty('fargate')) {
    // event is URL to a catalog node - start a Fargate instance to process
    console.log('Starting Fargate task to ingest URL')
    /*taskStarter({
      arn: context.invoked_function_arn,
      input: { event.fargate },
      cluster: 'SatApiECSCluster',
      taskDefinition: 'SatApiTaskRunner'
    })*/
  }
}
