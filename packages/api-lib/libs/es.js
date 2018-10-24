'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const readableStream = require('readable-stream')
const pump = require('pump')
const logger = require('./logger')

let _esClient

/*
This module is used for connecting to an Elasticsearch instance, writing records,
searching records, and managing the indexes. It looks for the ES_HOST environment
variable which is the URL to the elasticsearch host
*/


// get existing ES client or create a new one
async function esClient() {
  if (!_esClient) {
    _esClient = await connect()
    console.log('connected to elasticsearch')
  }
  else {
    console.log('using existing elasticsearch connection')
  }
  return _esClient
}


// Connect to an Elasticsearch cluster
async function connect() {
  let esConfig
  let client

  // use local client
  if (!process.env.ES_HOST) {
    client = new elasticsearch.Client({ host: 'localhost:9200' })
  }
  else {
    await new Promise((resolve, reject) => AWS.config.getCredentials((err) => {
      if (err) return reject(err)
      return resolve()
    }))

    esConfig = {
      host: process.env.ES_HOST,
      connectionClass: httpAwsEs,
      amazonES: {
        region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        credentials: AWS.config.credentials
      },
      // Note that this doesn't abort the query.
      requestTimeout: 120000 // milliseconds
    }
    client = new elasticsearch.Client(esConfig)
  }

  await new Promise((resolve, reject) => client.ping({ requestTimeout: 1000 }, (err) => {
    if (err) {
      console.log('unable to connect to elasticsearch')
      reject('unable to connect to elasticsearch')
    }
    else {
      resolve()
    }
  }))
  return client
}


// Create STAC mappings
async function prepare(index) {
  // TODO - different mappings for collection and item
  const props = {
    'type': 'nested',
    properties: {
      'collection': { type: 'keyword' },
      'datetime': { type: 'date' },
      'eo:cloud_cover': { type: 'integer' },
      'eo:gsd': { type: 'float' },
      'eo:constellation': { type: 'keyword' },
      'eo:platform': { type: 'keyword' },
      'eo:instrument': { type: 'keyword' },
      'eo:epsg': { type: 'integer' },
      'eo:off_nadir': { type: 'float' },
      'eo:azimuth': { type: 'float' },
      'eo:sun_azimuth': { type: 'float' },
      'eo:sun_elevation': { type: 'float' }
    }
  }

  return esClient().then((client) => {
    return client.indices.exists({ index }).then((exist) => {
      if (!exist) {
        const payload = {
          index: index,
          body: {
            mappings: {
              doc: {
                /*'_all': {
                  enabled: true
                },*/
                properties: {
                  'id': { type: 'keyword' },
                  'properties': props,
                  geometry: {
                    type: 'geo_shape',
                    tree: 'quadtree',
                    precision: '5mi'
                  }
                }
              }
            }
          }
        }
        return client.indices.create(payload)
          .then(() => {
            console.log(`Created index: ${JSON.stringify(payload)}`)
          })
          .catch((err) => { 
            console.log('Error creating index, already created: ', err)
          })
      }
    })
  })
}


// Given an input stream and a transform, write records to an elasticsearch instance
async function _stream(stream, transform, index) {

  let nRecords = 0
  let nTransformed = 0
  let nSaved = 0

  const toEs = through2({ objectMode: true, consume: true }, function (data, encoding, next) {
    const record = {
      index,
      type: 'doc',
      id: data.id,
      action: 'update',
      _retry_on_conflict: 3,
      body: {
        doc: data,
        doc_as_upsert: true
      }
    }
    this.push(record)
    next()
  })

  return esClient().then((client) => {
    const esStream = new ElasticsearchWritableStream(client, {
      highWaterMark: 100,
      flushTimeout: 1000
    })

    return new Promise((resolve, reject) => {
      pump(stream, transform, toEs, esStream, (err) => {
        if (err) {
          console.log('error:', err)
          reject(err)
        }
        else {
          console.log(`Saving ${index} records: ${nRecords} in, ${nTransformed} saved.`)
          resolve(nTransformed)
        }
      })
      // count records
      stream.on('data', () => {
        nRecords += 1
      })
      toEs.on('data', () => {
        nTransformed += 1
      })
      // this doesn't seem to work
      //esStream.on('data', () => { nSaved += 1 })
    })
  })
    .catch((e) => console.log(e))
}


// general search of an index
function search(params, index, page, limit, callback) {
  console.log('Search parameters: ', JSON.stringify(params))
  const searchParams = {
    index: index,
    body: build_query(params),
    size: limit,
    from: (page - 1) * limit
    //_source: this.fields
  }

  console.log('Search query (es): ', JSON.stringify(searchParams))

  // connect to ES then search
  esClient().then((client) => {
    client.search(searchParams).then((body) => {
      const count = body.hits.total
      const results = body.hits.hits.map((r) => (r._source))

      const response = {
        meta: {
          found: count,
          returned: results.length,
          limit: limit,
          page: page
        },
        results: results
      }

      console.log(`Search response: ${JSON.stringify(response)}`)

      return callback(null, response)
    }, (err) => {
      logger.error(err)
      return callback(err)
    })
  })
}


function build_query(params) {
  // no filters, return everything
  if (Object.keys(params).length === 0) {
    return {
      query: { match_all: {} }
    }
  }

  let queries = []

  // intersects search
  if (params.intersects) {
    queries.push({ 
      geo_shape: { [field]: { shape: params.intersects.geometry } } 
    })
    delete params.intersects
  }

  // create range and term queries
  let range
  for (var key in params) {
    range = params[key].split('/')
    if (range.length > 1) {
      queries.push(rangeQuery(key, range[0], range[1]))
    } else {
      queries.push(termQuery(key, params[key]))
    }
  }

  if (queries.length === 1) {
    return { query: queries[0] }
  } else {
    return { query: { bool: { must: queries } } }
  }

}


// Create a term query
const termQuery = (field, value) => {
  // the default is to search the properties of a record
  let _field = field
  if (field !== 'id') {
    _field = `properties.${field}`
  }
  const vals = value.split(',').filter((x) => x)
  const terms = vals.map((v) => ({ term: { [_field]: v } }))
  // also return if the field is absent entirely
  terms.push({ bool: { must_not: { exists: { field: _field } } } })
  let query = {
    bool: {
      should: terms
    }
  }
  if (field !== 'id') {
    query = { nested: { path: 'properties', query: query } }
  }
  return query
}


// Create a range query
const rangeQuery = (field, frm, to) => {
  // range queries will always be on properties
  const _field = `properties.${field}`
  let query = {
    bool: {
      should: [
        { range: { [_field]: { gte: frm, lte: to } } },
        { bool: { must_not: { exists: { field: _field } } } }
      ]
    }
  }
  query = { nested: { path: 'properties', query: query } }
  return query
}


async function saveCollection(collection) {
  function iStream(x, enc, next) { this.push(x); next() }
  const iTransform = through2({ objectMode: true, consume: true }, iStream)

  // ensure collections mapping in ES
  return prepare('collections').then(() => {
    // create input stream from collection record
    const inStream = new readableStream.Readable({ objectMode: true })
    inStream.push(collection)
    inStream.push(null)
    return _stream(inStream, iTransform, 'collections')
  })
}


module.exports.prepare = prepare
module.exports.stream = _stream
module.exports.search = search

module.exports.saveCollection = saveCollection
