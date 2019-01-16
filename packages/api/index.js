/* eslint-disable new-cap */

'use strict'

const satlib = require('@sat-utils/api-lib')

module.exports.handler = async (event) => {
  // determine endpoint
  let endpoint
  if ('X-Forwarded-Host' in event.headers) {
    endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers['X-Forwarded-Host']}`
  } else {
    endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers.Host}`
    if ('stage' in event.requestContext) {
      endpoint = `${endpoint}/${event.requestContext.stage}`
    }
  }

  const buildResponse = (statusCode, body) => ({
    isBase64Encoded: false,
    statusCode,
    body,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true
    }
  })

  // get payload
  const method = event.httpMethod
  let query = {}
  if (method === 'POST' && event.body) {
    query = JSON.parse(event.body)
  } else if (method === 'GET' && event.queryStringParameters) {
    query = event.queryStringParameters
  }

  const result = await satlib.api.search(event.path, query, satlib.es, endpoint)
  let returnResponse
  if (result instanceof Error) {
    returnResponse = buildResponse(404, result.message)
  } else {
    returnResponse = buildResponse(200, JSON.stringify(result))
  }
  return returnResponse
}
