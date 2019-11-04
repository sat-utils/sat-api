/* eslint-disable new-cap, no-lonely-if */

'use strict'

const satlib = require('@sat-utils/api-lib')

module.exports.handler = async (event) => {
  // determine endpoint
  let endpoint = process.env.SATAPI_URL
  if (typeof endpoint === 'undefined') {
    if ('X-Forwarded-Host' in event.headers) {
      endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers['X-Forwarded-Host']}`
    } else {
      endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers.Host}`
      if ('stage' in event.requestContext) {
        endpoint = `${endpoint}/${event.requestContext.stage}`
      }
    }
  }

  const buildResponse = async (statusCode, result) => {
    const response = {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Required for CORS support to work
        'Access-Control-Allow-Credentials': true
      },
      body: result
    }
    return response
  }

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
