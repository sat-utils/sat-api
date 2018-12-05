'use strict'

const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')
const taskStarter = require('@developmentseed/task-starter')

// SNS message
module.exports.handler = function handler(event, context) {
  console.log('Ingest message: ', JSON.stringify(event))

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
    console.log(`Ingesting URL ${JSON.stringify(event)}`)
    satlib.ingest.ingest(event.url, recursive, collectionsOnly)
  } else if (event.hasOwnProperty('fargate')) {
  if (event.hasOwnProperty('fargate')) {
    // event is URL to a catalog node - start a Fargate instance to process
    console.log('Starting Fargate task to ingest URL')
    // TODO - pass in all args from event
    const payload = {
      arn: context.invokedFunctionArn,
      input: { url: event.fargate.url },
      cluster: process.env.CLUSTER_ARN,
      taskDefinition: process.env.TASK_ARN,
      subnets: event.fargate.subnets,
      securityGroups: event.fargate.securityGroups,
      roleArn: process.env.ECS_ROLE_ARN
    }
    taskStarter.handler(payload, context, (err) => {
      if (err) { console.log(`Error: ${JSON.stringify(err)}`) }
    })
  }
}
