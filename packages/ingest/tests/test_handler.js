const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const createEvent = require('aws-event-mocks')

const setup = () => {
  const ingest = sinon.stub().resolves(true)
  const ingestItem = sinon.stub().resolves(true)
  const elasticsearch = 'elasticsearch'
  const satlib = {
    ingest: {
      ingest,
      ingestItem
    },
    es: elasticsearch
  }
  const lambda = proxyquire('../index.js', {
    '@sat-utils/api-lib': satlib
  })
  return {
    ingest,
    ingestItem,
    elasticsearch,
    lambda
  }
}

test('handler uses non-recursive ingest for S3 SNS Event', async (t) => {
  const { ingest, lambda, elasticsearch } = setup()
  const bucket = 'bucket'
  const key = 'key'
  const s3Event = createEvent({
    template: 'aws:s3',
    merge: {
      Records: [{
        eventName: 'ObjectCreated:Put',
        s3: {
          bucket: {
            name: bucket
          },
          object: {
            key: key
          }
        }
      }]
    }
  })
  const message = JSON.stringify(s3Event)

  const snsEvent = createEvent({
    template: 'aws:sns',
    merge: {
      Records: [{
        Sns: {
          Message: message
        }
      }]
    }
  })
  await lambda.handler(snsEvent)
  const expectedUrl = `https://${bucket}.s3.amazonaws.com/${key}`
  const expectedRecursive = false
  t.is(ingest.firstCall.args[0], expectedUrl, 'S3 Url is parsed correctly')
  t.is(ingest.firstCall.args[1], elasticsearch, 'ES library passed as parameter')
  t.is(ingest.firstCall.args[2], expectedRecursive, 'Recursive is false')
})

test('handler calls ingestItem when event payload is a feature', async (t) => {
  const { ingestItem, lambda, elasticsearch } = setup()
  const event = {
    type: 'Feature'
  }
  await lambda.handler(event)
  t.deepEqual(ingestItem.firstCall.args[0], event, 'Calls ingestItem with event')
  t.is(ingestItem.firstCall.args[1], elasticsearch, 'ES library passed as a parameter')
})
