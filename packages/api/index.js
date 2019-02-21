/* eslint-disable new-cap, no-lonely-if */

'use strict'

const zlib = require('zlib')
const { promisify } = require('util')
const satlib = require('@sat-utils/api-lib')
const gzip = promisify(zlib.gzip)

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

  const lowerCaseHeaders = (headers) => Object.entries(headers).reduce(
    (acc, [key, value]) => {
      acc[typeof key === 'string' ? key.toLowerCase() : key] = value
      return acc
    }, {}
  )

  const buildResponse = async (statusCode, result) => {
    const headers = lowerCaseHeaders(event.headers)
    const acceptEncoding = headers['accept-encoding'] || ''
    const encodings = acceptEncoding.split(',')
    const isGzip = encodings.includes('gzip')
    const response = {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Required for CORS support to work
        'Access-Control-Allow-Credentials': true
      }
    }
    if (isGzip) {
      const zipped = await gzip(result)
      response.body = zipped.toString('base64')
      response.headers['Content-Encoding'] = 'gzip'
    } else {
      response.body = result
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
