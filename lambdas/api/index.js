'use strict'

const zlib = require('zlib')
const satlib = require('sat-api-lib')
const util = require('lambda-proxy-utils')
const get = require('lodash.get')


module.exports.handler = function (event, context, cb) {
  console.log(`API handler: ${JSON.stringify(event)}`)

  // get payload
  const method = event.httpMethod
  const payload = { query: {}, headers: event.headers }
  if (method === 'POST' && event.body) {
    payload.query = JSON.parse(event.body)
  }
  else if (method === 'GET' && event.queryStringParameters) {
    payload.query = event.queryStringParameters
  }

  // send response to browser
  function respond(err, resp) {
    if (err) {
      console.log(err)
      const res = new util.Response({ cors: true, statusCode: 400 })
      return cb(null, res.send({ details: err.message }))
    }
    const res = new util.Response({ cors: true, statusCode: 200 })
    return cb(null, res.send(resp))
  }


  const resources = event.resource.split('/')
  switch (resources[1]) {
    case 'api':
      // this should return API doc
      console.log('/api')
      respond(null, 'TODO - return API doc')
      break
    case 'collections':
      // collections api
      console.log('/collections')
      //respond(null, 'collections')
      satlib.es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        api.search('collections', respond)
      })
      break
    case 'search':
      // items api
      console.log('/search')
      satlib.es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        api.search_items(respond)
      })

      break
  }

}
