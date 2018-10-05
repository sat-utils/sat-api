'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const pump = require('pump')
const logger = require('./logger')

let _esClient

/*
This module is used for connecting to an Elasticsearch instance, writing records
and managing the indexes. It looks for the ES_HOST environment variable which is 
the URL to the elasticsearch host
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
async function prep(index) {
  // TODO - different mappings for collection and item
  // make sure the index doesn't exist
  esClient().then((client) => {
    client.indices.exists({ index}).then((exist) => {
      if (!exist) {
        console.log(`Creating index: ${index}`)
        return client.indices.create({
          index,
          body: {
            mappings: {
              doc: {
                /*'_all': {
                  enabled: true
                },*/
                properties: {
                  "name": {type: 'keyword'},
                  "properties": {
                    "type": "nested",
                    properties: {
                      'id': { type: 'keyword' },
                      'datetime': { type: 'date' },
                      'eo:cloud_cover': { type: 'integer' },
                      'eo:gsd': { type: 'float' },
                      'eo:off_nadir': { type: 'float' },
                      'eo:azimuth': { type: 'float' },
                      'eo:sun_azimuth': { type: 'float' },
                      'eo:sun_elevation': { type: 'float' }
                    }
                  },
                  geometry: {
                    type: 'geo_shape',
                    tree: 'quadtree',
                    precision: '5mi'
                  }
                }
              }
            }
          }
        }).catch((err) => {
          console.log('Error creating index, already created: ', err)
        })
      }
    })
  })
}


// Given an input stream and a transform, write records to an elasticsearch instance
function streamToEs(stream, transform, client, index) {

  let nRecords = 0
  let nTransformed = 0

  const toEs = through2({ objectMode: true, consume: true }, function (data, encoding, next) {
    const record = {
      index,
      type: 'doc',
      id: data.properties.id,
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

  const esStream = new ElasticsearchWritableStream(client, {
    highWaterMark: 100,
    flushTimeout: 1000
  })

  return new Promise((resolve, reject) => {
    pump(stream, transform, toEs, esStream, (err) => {
      if (err) {
        console.log('error:', err)
        reject(nTransformed)
      }
      else {
        console.log(`Finished: ${nRecords} records, ${nTransformed} transformed, `)
        resolve(nTransformed)
      }
    })

    // count records
    stream.on('data', () => { nRecords += 1 })
    toEs.on('data', () => { nTransformed += 1 })
  })
}


// Save records in elasticsearch
async function saveRecords(client, records, index, idfield, callback) {
  const body = []

  records.forEach((r) => {
    body.push({
      update: {
        _index: index, _type: 'doc', _id: r[idfield], _retry_on_conflict: 3
      }
    })
    body.push({ doc: r, doc_as_upsert: true })
  })

  let updated = 0
  let errors = 0

  return client.bulk({ body }, (err, resp) => {
    if (err) {
      console.log(err)
    }
    else {
      if (resp.errors) {
        resp.items.forEach((r) => {
          if (r.update.status === 400) {
            console.log(r.update.error.reason)
            errors += 1
          }
          else {
            updated += 1
          }
        })
      }
      else {
        updated = resp.items.length
      }
      //added = added + resp.items.length
      callback(null, updated, errors)
    }
  })
}



// Reindex elasticsearch documents
async function reindex(client, source, dest) {
  return client.reindex({
    body: {
      source: {
        index: source
      },
      dest: {
        index: dest
      }
    }
  })
}

// Delete STAC index
async function deleteIndex(client, index) {
  return client.indices.delete({ index })
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

      const response = {
        properties: {
          found: count,
          limit: this.limit,
          page: this.page
        }
      }

      response.results = body.hits.hits.map((r) => (r._source))

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

  return {
    query: { bool: { must: queries } }
  }
}


// Create a term query
const termQuery = (field, value) => {
  // the default is to search the properties of a record
  if (field !== 'id' && field !== 'name') {
    field = 'properties.' + field
  }
  let query = {
    bool: {
      should: [
        { term: { [field]: value } },
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }
  if (field !== 'id' && field !== 'name') {
    query = { nested: { path: 'properties', query: query } }
  }
  return query
}


// Create a range query
const rangeQuery = (field, frm, to) => {
  // range queries will always be on properties
  field = 'properties.' + field
  let query = {
    bool: {
      should: [
        { range: { [field]: { gte: frm, lte: to } } },
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }
  query = { nested: { path: 'properties', query: query } }
  return query
}


module.exports.search = search
module.exports.prep = prep
module.exports.streamToEs = streamToEs
module.exports.saveRecords = saveRecords

// management functions
module.exports.reindex = reindex
module.exports.deleteIndex = deleteIndex