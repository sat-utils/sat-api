'use strict'

const zlib = require('zlib')
const satlib = require('sat-api-lib')
const util = require('lambda-proxy-utils')
const get = require('lodash.get')
const es = require('../../lib/es')


module.exports.handler = function (event, context, cb) {
  console.log(`API handler: ${JSON.stringify(event)}`)

  const method = event.httpMethod
  const payload = { query: {}, headers: event.headers }
  if (method === 'POST' && event.body) {
    payload.query = JSON.parse(event.body)
  }
  else if (method === 'GET' && event.queryStringParameters) {
    payload.query = event.queryStringParameters
  }

  function respond(err, resp) {
    if (err) {
      console.log(err)
      const res = new util.Response({ cors: true, statusCode: 400 })
      return cb(null, res.send({ details: err.message }))
    }
    const res = new util.Response({ cors: true, statusCode: 200 })
    //return cb(null, res.send(JSON.stringify(resp, null, 2)))
    return cb(null, res.send(resp))
  }


  const resources = event.resource.split('/')
  console.log(resources)

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
      es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        api.search('collections', respond)
      })
      break
    case 'search':
      // items api
      console.log('/search')
      es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        //const encoding = get(req, 'headers.Accept-Encoding', null)
        api.search('items', respond)
      })

      break
  }

}
