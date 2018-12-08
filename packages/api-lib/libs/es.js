'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('./ElasticSearchWriteableStream')
//const logger = require('./logger')

let _esClient

/*
This module is used for connecting to an Elasticsearch instance, writing records,
searching records, and managing the indexes. It looks for the ES_HOST environment
variable which is the URL to the elasticsearch host
*/

// Connect to an Elasticsearch cluster
async function connect() {
  let esConfig
  let client

  // use local client
  if (!process.env.ES_HOST) {
    client = new elasticsearch.Client({ host: 'localhost:9200' })
  } else {
    await new Promise((resolve, reject) => AWS.config.getCredentials((err) => {
      if (err) return reject(err)
      return resolve()
    }))

    AWS.config.update({
      credentials: new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID,
        process.env.AWS_SECRET_ACCESS_KEY),
      region: process.env.AWS_REGION || 'us-east-1'
    })

    esConfig = {
      hosts: [process.env.ES_HOST],
      connectionClass: httpAwsEs,
      awsConfig: new AWS.Config({ region: process.env.AWS_REGION || 'us-east-1' }),
      httpOptions: {},
      // Note that this doesn't abort the query.
      requestTimeout: 120000 // milliseconds
    }
    client = new elasticsearch.Client(esConfig)
  }
  await new Promise((resolve, reject) => client.ping({ requestTimeout: 1000 }, (err) => {
    if (err) {
      reject('unable to connect to elasticsearch')
    } else {
      resolve()
    }
  }))
  return client
}

// get existing ES client or create a new one
async function esClient() {
  if (!_esClient) {
    _esClient = await connect().catch((err) => console.log('Error: ', err))
    if (_esClient) console.log('connected to elasticsearch')
  } else {
    console.log('using existing elasticsearch connection')
  }
  return _esClient
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

  return esClient().then((client) =>
    client.indices.exists({ index }).then((exist) => {
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
      return 0
    }))
    .catch((err) => console.log(`Error connecting to elasticsearch: ${JSON.stringify(err)}`))
}

// Given an input stream and a transform, write records to an elasticsearch instance
async function _stream() {
  const toEs = through2.obj({ objectMode: true }, function (data, encoding, next) {
    let index = ''
    if (data && data.hasOwnProperty('extent')) {
      index = 'collections'
    } else if (data && data.hasOwnProperty('geometry')) {
      index = 'items'
    } else {
      next()
      return
    }
    // remove any hierarchy links
    const dataNoLinks = Object.assign({}, data, { links: [] })
    // create ES record
    const record = {
      index,
      type: 'doc',
      id: dataNoLinks.id,
      action: 'update',
      _retry_on_conflict: 3,
      body: {
        doc: dataNoLinks,
        doc_as_upsert: true
      }
    }
    next(null, record)
  })
  try {
    const client = await esClient()
    const esStream = new ElasticsearchWritableStream({ client: client }, {
      objectMode: true,
      highWaterMark: 50
    })
    return { toEs, esStream }
  } catch (err) {
    console.log(err)
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

function build_query(params) {
  // no filters, return everything
  const _params = Object.assign({}, params)
  if (Object.keys(_params).length === 0) {
    return {
      query: { match_all: {} }
    }
  }

  const queries = []

  // intersects search
  if (params.intersects) {
    queries.push({
      geo_shape: { 'field': { shape: params.intersects.geometry } }
    })
    delete _params.intersects
  }

  // create range and term queries
  let range
  Object.keys(_params).forEach((key) => {
    range = _params[key].split('/')
    if (range.length > 1) {
      queries.push(rangeQuery(key, range[0], range[1]))
    } else {
      queries.push(termQuery(key, _params[key]))
    }
  })

  if (queries.length === 1) {
    return { query: queries[0] }
  }
  return { query: { bool: { must: queries } } }
}

async function search(params, index = '*', page, limit) {
  console.log('Search parameters: ', JSON.stringify(params))

  const searchParams = {
    index,
    body: build_query(params),
    size: limit,
    from: (page - 1) * limit
  }

  const client = await esClient()
  const body = await client.search(searchParams)
  const results = body.hits.hits.map((r) => (r._source))
  const response = {
    results,
    meta: {
      page,
      limit,
      found: body.hits.total,
      returned: results.length
    }
  }
  return response
}

module.exports.prepare = prepare
module.exports.stream = _stream
module.exports.search = search
