'use strict'

const AWS = require('aws-sdk')
const satlib = require('@sat-utils/api-lib')

// Runs on Fargate
const runIngestTask = async function (input, envvars) {
  const ecs = new AWS.ECS()
  const params = {
    cluster: process.env.CLUSTER_ARN,
    taskDefinition: process.env.TASK_ARN,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: process.env.SUBNETS.split(' '),
        assignPublicIp: 'ENABLED',
        securityGroups: process.env.SECURITY_GROUPS.split(' ')
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

module.exports.handler = async function handler(event) {
  console.log(`Ingest Event: ${JSON.stringify(event)}`)
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
    } else if (event.url) {
      // event is URL to a catalog node
      const { url, recursive, collectionsOnly } = event
      const recurse = recursive === undefined ? true : recursive
      const collections = collectionsOnly === undefined ? false : collectionsOnly
      satlib.ingest.ingest(url, satlib.es, recurse, collections)
    } else if (event.fargate) {
      // event is URL to a catalog node - start a Fargate instance to process
      console.log(`Starting Fargate ingesttask ${JSON.stringify(event.fargate)}`)
      const envvars = [
        { 'name': 'ES_HOST', 'value': process.env.ES_HOST }
      ]
      await runIngestTask(event.fargate, envvars)
    }
  } catch (error) {
    console.log(error)
  }
}

