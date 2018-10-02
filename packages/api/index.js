/* eslint-disable new-cap */

'use strict'

const util = require('lambda-proxy-utils')
const satlib = require('@sat-utils/api-lib')


module.exports.handler = (event, context, cb) => {
  console.log(`API handler: ${JSON.stringify(event)}`)

  // get payload
  const method = event.httpMethod
  let endpoint
  if ('X-Forwarded-Host' in event.headers) {
    endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers['X-Forwarded-Host']}`
  }
  else {
    endpoint = `${event.headers['X-Forwarded-Proto']}://${event.headers.Host}`
    if ('stage' in event.requestContext) {
      endpoint = `${endpoint}/${event.requestContext.stage}`
    }
  }

  const payload = { query: {}, headers: event.headers, endpoint: endpoint }
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

  // split and remove empty strings
  const resources = event.path.split('/').filter((x) => x)
  console.log('resources', resources)
  let msg
  if (resources[0] !== 'stac') {
    msg = 'endpoint not defined'
    console.log(msg, resources)
    respond(null, msg)
    return
  }

  // /stac
  if (resources.length === 1) {
    msg = 'STAC catalog (see endpoints /search and /collections)'
    const catalog = {
      name: 'sat-api',
      description: 'A STAC API of public datasets',
      links: [{ rel: 'self', href: `${endpoint}/stac` }]
    }
    satlib.es.client().then((esClient) => {
      payload.query.limit = 100
      const api = new satlib.api(payload, esClient)
      api.search('collections', (err) => {
        if (err) respond(err)
        // loop through collections and add to links
        catalog.links.push({ rel: 'dataset', hred: '' })
      })
    })
    respond(null, catalog)
  }
  resources.splice(0, 1)

  // STAC endpoints
  switch (resources[0]) {
  case 'api':
    msg = 'TODO - return API doc'
    console.log(msg, resources)
    respond(null, msg)
    break
  case 'collections':
    if (resources.length === 1) {
      satlib.es.client().then((esClient) => {
        payload.query.limit = 100
        const api = new satlib.api(payload, esClient)
        api.search('collections', respond)
      })
      break
    }
    else if (resources.length === 2) {
      msg = 'endpoint not defined'
      console.log(msg, resources)
      respond(null, msg)
      break
    }
    payload.query['c:id'] = resources[1]
    switch (resources[2]) {
    case 'items':
      console.log('search items in this collection')
      // this is a search across items in this collection
      satlib.es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        api.search_items(respond)
      })
      break
    case 'definition':
      console.log('collection definition')
      satlib.es.client().then((esClient) => {
        const api = new satlib.api(payload, esClient)
        api.search('collections', respond)
      })
      break
    default:
      msg = 'endpoint not defined'
      console.log(msg, resources)
      respond(null, msg)
    }
    break
  case 'search':
    // items api
    satlib.es.client().then((esClient) => {
      const api = new satlib.api(payload, esClient)
      api.search_items(respond)
    })
    break
  default:
    cb('endpoint not defined')
  }
}
