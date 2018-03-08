'use strict'

const zlib = require('zlib')
const Api = require('sat-api-lib')
const util = require('lambda-proxy-utils')
const get = require('lodash.get')
const es = require('../../lib/es')
let esClient;

function search(req, cb) {
  const s = new Api(req, esClient);
  //const encoding = get(req, 'headers.Accept-Encoding', null);
 
  s['search'](function (err, resp) {
    if (err) {
      console.log(err);
      const res = new util.Response({ cors: true, statusCode: 400 });
      return cb(null, res.send({ details: err.message }));
    }
    const res = new util.Response({ cors: true, statusCode: 200 });
    return cb(null, res.send(resp));
    /*
    if (encoding && encoding.includes('gzip')) {
      zlib.gzip(JSON.stringify(resp), function(error, gzipped) {
        //if(error) context.fail(error);
        const response = {
          statusCode: 200,
          body: gzipped.toString('base64'),
          isBase64Encoded: true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip'
          }
        };
        return cb(error, response);
      });
    }
    else {
      return cb(null, res.send(resp));
    }
    */
  });
}


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

  if (!esClient) {
    console.log('connecting to ES');
    es.connect().then((client) => {
      esClient = client;
      search(payload, cb);
    });
  }
  else {
    search(payload, cb);
  }
};
