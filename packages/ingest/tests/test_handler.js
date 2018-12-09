const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const createEvent = require('aws-event-mocks')

test('handler uses non-recursive ingest for S3 SNS Event', async (t) => {
  const ingest = sinon.stub().resolves(true)
  const satlib = {
    ingest: {
      ingest
    }
  }
  const lambda = proxyquire('../index.js', {
    '@sat-utils/api-lib': satlib
  })

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
  t.is(ingest.firstCall.args[2], expectedRecursive, 'Recursive is false')
})
