'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const pump = require('pump')

let esClient

/*
This module is used for connecting to an Elasticsearch instance, writing records
and managing the indexes. It looks for the ES_HOST environment variable which is 
the URL to the elasticsearch host
*/

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

// get existing ES client or create a new one
async function Client() {
  if (!esClient) {
    esClient = await connect()
    console.log('connected to elasticsearch')
  }
  else {
    console.log('using existing elasticsearch connection')
  }
  return esClient
}


// Create STAC mappings
async function putMapping(client, index) {
  // TODO - different mappings for collection and item
  // make sure the index doesn't exist
  const exist = await client.indices.exists({ index })
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

  return Promise.resolve()
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
    stream.on('data', () => {
      nRecords += 1
    })
    toEs.on('data', () => {
      nTransformed += 1
    })
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


module.exports.client = Client
module.exports.reindex = reindex
module.exports.putMapping = putMapping
module.exports.deleteIndex = deleteIndex
module.exports.streamToEs = streamToEs
module.exports.saveRecords = saveRecords
