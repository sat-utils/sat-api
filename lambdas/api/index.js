'use strict'

const zlib = require('zlib')
const api = require('sat-api-lib')
const util = require('lambda-proxy-utils')
const get = require('lodash.get')
const es = require('../../lib/es')


module.exports.handler = function (event, context, cb) {
  console.log(`API handler: ${JSON.stringify(event)}`)

  const resources = event.resource.split('/')

  switch (resources[0]) {
    case 'api':
      console.log('/api')
      cb()
      break
    case 'collections':
      console.log('/collections')
      cb()
      break
    case 'search':
      console.log('/search')
      break
  }

  const method = event.httpMethod
  const payload = { query: {}, headers: event.headers }
  if (method === 'POST' && event.body) {
    payload.query = JSON.parse(event.body);
  }
  else if (method === 'GET' && event.queryStringParameters) {
    payload.query = event.queryStringParameters;
  }
    
  es.client().then((esClient) => {

    const search = new api.search(payload, esClient);
    //const encoding = get(req, 'headers.Accept-Encoding', null);
    
    search.search(function (err, resp) {
      if (err) {
        console.log(err);
        const res = new util.Response({ cors: true, statusCode: 400 });
        return cb(null, res.send({ details: err.message }));
      }
      const res = new util.Response({ cors: true, statusCode: 200 });
      return cb(null, res.send(resp));
    }); 
  })
}
