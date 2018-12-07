'use strict'

const AWS = require('aws-sdk')
const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')


module.exports.handler = function handler(event, context) {
  try {
    event = JSON.parse(event)
  } catch(err) {}
  console.log('Ingest message: ', JSON.stringify(event))

  // event is SNS message of updated file on s3
  if (event.hasOwnProperty('Records')) {
    const msg = JSON.parse(event.Records[0].Sns.Message)
    msg.Records.forEach((val) => {
      // msg is link to updated file
      const url = `https://${val.s3.bucket.name}.s3.amazonaws.com/${val.s3.object.key}`
      console.log(`Ingesting catalog file ${url}`)
      satlib.ingest.ingest(url, recursive=false)
    })
  // event is a STAC Item
  } else if (event.hasOwnProperty('type' === 'Feature')) {
    // event is STAC record itself
    console.log(`Ingesting STAC Item ${event.id}`)
    const inStream = new readableStream.Readable({ objectMode: true })
    inStream.push(event)
    inStream.push(null)
    satlib.es.stream(inStream)
  // event is URL to a catalog node
  } else if (event.hasOwnProperty('url')) {
    const recursive = event.recursive || true
    const collectionsOnly = event.collectionsOnly || false
    satlib.ingest.ingest(event.url, recursive, collectionsOnly)
  } else if (event.hasOwnProperty('fargate')) {
    // event is URL to a catalog node - start a Fargate instance to process
    console.log(`Starting Fargate ingesttask ${JSON.stringify(event.fargate)}`)
    const envvars = [
      { 'name': 'ES_HOST', 'value': process.env.ES_HOST }
    ]
    runIngestTask(event.fargate, envvars, (err) => {
      if (err) { console.log(`Error: ${JSON.stringify(err)}`) }
    })
  }
}


// Runs on Fargate
const runIngestTask = async function (input, envvars, cb) {
  const ecs = new AWS.ECS()
  const params = {
    cluster: process.env.CLUSTER_ARN,
    taskDefinition: process.env.TASK_ARN,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: JSON.parse(process.env.SUBNETS),
        assignPublicIp: 'ENABLED',
        securityGroups: JSON.parse(process.env.SECURITY_GROUPS)
      }
    },
    overrides: {
      containerOverrides: [
        {
          command: [
            'node',
            'packages/ingest/bin/ingest.js',
            JSON.stringify(input)
          ],
          environment: envvars,
          name: 'SatApi'
        }
      ],
      executionRoleArn: process.env.ECS_ROLE_ARN,
      taskRoleArn: process.env.ECS_ROLE_ARN
    }
  }
  return ecs.runTask(params).promise()
}