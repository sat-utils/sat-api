/* eslint-disable new-cap */

'use strict'

const util = require('lambda-proxy-utils')
const satlib = require('@sat-utils/api-lib')


module.exports.handler = (event, context, cb) => {
  console.log(`API handler: ${JSON.stringify(event)}`)

  // function to send response to browser
  function respond(err, resp) {
    if (err) {
      console.log(err)
      const res = new util.Response({ cors: true, statusCode: 400 })
      return cb(null, res.send({ details: err.message }))
    }
    const res = new util.Response({ cors: true, statusCode: 200 })
    return cb(null, res.send(resp))
  }

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

  // get payload
  const method = event.httpMethod
  let query = {}
  if (method === 'POST' && event.body) {
    query = JSON.parse(event.body)
  } else if (method === 'GET' && event.queryStringParameters) {
    query = event.queryStringParameters
  }

  satlib.api.STAC(event.path, endpoint, query, satlib.es, respond)
}
