const satlib = require('@sat-utils/api-lib')

function determineEndpoint(event) {
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
  return endpoint
}

function buildRequest(event) {
  const method = event.httpMethod
  let query = {}
  if (method === 'POST' && event.body) {
    query = JSON.parse(event.body)
  } else if (method === 'GET' && event.queryStringParameters) {
    query = event.queryStringParameters
  }
  return query
}

function buildResponse(statusCode, result) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true
    },
    body: result
  }
}

module.exports.handler = async (event) => {
  const endpoint = determineEndpoint(event)
  const query = buildRequest(event)
  const result = await satlib.api.API(event.path, query, satlib.es, endpoint)
  return result instanceof Error ?
    buildResponse(404, result.message) :
    buildResponse(200, JSON.stringify(result))
}
