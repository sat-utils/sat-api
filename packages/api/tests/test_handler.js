const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const createEvent = require('aws-event-mocks')

test('handler calls search with parameters', async (t) => {
  const result = { value: 'value' }
  const search = sinon.stub().resolves(result)
  const satlib = {
    api: {
      search
    }
  }
  const lambda = proxyquire('../index.js', {
    '@sat-utils/api-lib': satlib
  })
  const host = 'host'
  const httpMethod = 'GET'
  const path = 'path'

  const queryStringParameters = {
    test: 'test'
  }
  const event = createEvent({
    template: 'aws:apiGateway',
    merge: {
      headers: {
        Host: host,
        'Accept-Encoding': ''
      },
      requestContext: {},
      httpMethod,
      queryStringParameters,
      path
    }
  })

  const actual = await lambda.handler(event)
  const { args } = search.firstCall
  t.is(args[0], path)
  t.deepEqual(args[1], queryStringParameters)
  t.is(args[3], `https://${host}`)
  t.is(actual.statusCode, 200)
  t.is(actual.body, JSON.stringify(result))
})

test('handler returns 404 for error', async (t) => {
  const errorMessage = 'errorMessage'
  const result = new Error(errorMessage)
  const search = sinon.stub().resolves(result)
  const satlib = {
    api: {
      search
    }
  }
  const lambda = proxyquire('../index.js', {
    '@sat-utils/api-lib': satlib
  })
  const host = 'host'
  const httpMethod = 'GET'
  const path = 'path'

  const queryStringParameters = {
    test: 'test'
  }
  const event = createEvent({
    template: 'aws:apiGateway',
    merge: {
      headers: {
        Host: host,
        'Accept-Encoding': ''
      },
      requestContext: {},
      httpMethod,
      queryStringParameters,
      path
    }
  })

  const actual = await lambda.handler(event)
  t.is(actual.statusCode, 404)
  t.is(actual.body, errorMessage)
})
