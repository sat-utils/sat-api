'use strict'

const AWS = require('aws-sdk')
const readableStream = require('readable-stream')
const satlib = require('@sat-utils/api-lib')

module.exports.handler = async function handler(event) {
  try {
    if (event.Records && (event.Records[0].EventSource === 'aws:sns')) {
      // event is SNS message of updated file on s3
      const message = JSON.parse(event.Records[0].Sns.Message)
      const { Records: s3Records } = message
      const promises = s3Records.map((s3Record) => {
        const {
          s3: {
            bucket: { name: bucketName },
            object: { key }
          }
        } = s3Record
        const url = `https://${bucketName}.s3.amazonaws.com/${key}`
        console.log(`Ingesting catalog file ${url}`)
        const recursive = false
        return satlib.ingest.ingest(url, satlib.es, recursive)
      })
      await Promise.all(promises)
    } else if (event.type && event.type === 'Feature') {
      // event is a STAC Item provided as cli parameter
      await satlib.ingest.ingestItem(event, satlib.es)
    }
    //} else if (event.hasOwnProperty('url')) {
      //// event is URL to a catalog node
      //const recursive = event.recursive || true
      //const collectionsOnly = event.collectionsOnly || false
      //satlib.ingest.ingest(event.url, recursive, collectionsOnly)
    //} else if (event.hasOwnProperty('fargate')) {
      //// event is URL to a catalog node - start a Fargate instance to process
      //console.log(`Starting Fargate ingesttask ${JSON.stringify(event.fargate)}`)
      //const envvars = [
        //{ 'name': 'ES_HOST', 'value': process.env.ES_HOST }
      //]
      //runIngestTask(event.fargate, envvars, (err) => {
        //if (err) { console.log(`Error: ${JSON.stringify(err)}`) }
      //})
    //}
  } catch (error) {
    console.log(error)
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

