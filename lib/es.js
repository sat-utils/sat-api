'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('elasticsearch-writable-stream')
const pump = require('pump')

let esClient;

/*
This module looks for the ES_HOST environment variable which is the URL to the
elasticsearch host
*/


async function Client() {
  if (!esClient) {
    console.log('connecting to elasticsearch');
    esClient = await connect()
  } else {
    console.log('using existing elasticsearch connection')
  }
  return esClient
}


// Connect to an Elasticsearch cluster
async function connect() {
  
  let esConfig
  let client

  // use local client
  if (!process.env.ES_HOST) {
    client = new elasticsearch.Client({host: 'localhost:9200'})
  } else {
    await new Promise((resolve, reject) => AWS.config.getCredentials((err) => {
      if (err) return reject(err)
      resolve()
    }))

    esConfig = {
      host: process.env.ES_HOST,
      connectionClass: httpAwsEs,
      amazonES: {
        region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
        credentials: AWS.config.credentials
      },
      // Note that this doesn't abort the query.
      requestTimeout: 120000  // milliseconds
    }
    client = new elasticsearch.Client(esConfig)
  }

  await new Promise((resolve, reject) => client.ping({requestTimeout: 1000}, (err) => {
    if (err) {
      console.log('unable to connect to elasticsearch')
      reject('unable to connect to elasticsearch')
    } else {
      console.log('connected to elasticsearch')
      resolve()
    }
  }))
  return client
}


async function listIndices(esClient, index) {
  return esClient.indices.get({ index })
}


async function putMapping(esClient, index) {
  // make sure the index doesn't exist
  const exist = await esClient.indices.exists({index})
  if (!exist) {
    console.log(`Creating index: ${index}`)
    return esClient.indices.create({
      index,
      body: {
        mappings: {
          '_default_': {
            /*'_all': {
              enabled: true
            },*/
            properties: {
              id: { type: 'string' },
              datetime: { type: 'date' },
              start: { type: 'date' },
              end: { type: 'date' },
              geometry: {
                type: 'geo_shape',
                tree: 'quadtree',
                precision: '5mi'
              },
              "eo:cloud_cover": { type: 'float' },
              "eo:platform": { type: 'string' },
              "eo:instrument": { type: 'string' }
            }
          }
        }
      }
    })
  }
  throw new Error('The index is already created. Can\'t put mapping')
}


async function reindex(esClient, source, dest) {
  return esClient.reindex({
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


async function deleteIndex(esClient, index) {
  return esClient.indices.delete({ index })
}


function streamToEs(stream, transform, esClient, index) {
  // Given an input stream and a transform, write records to an elasticsearch instance

  var n_records = 0
  var n_csv = 0
  var n_transformed = 0

  var toEs = through2({'objectMode': true, 'consume': true}, function(data, encoding, next) {
    var record = {
      index,
      type: 'sat', 
      id: data['id'],
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

  var esStream = new ElasticsearchWritableStream(esClient, {
    highWaterMark: 100,
    flushTimeout: 1000
  })

  return new Promise((resolve, reject) => {
    pump(stream, transform, toEs, esStream, function(err) {
      if (err) {
        console.log('error:', err)
        reject(n_transformed)
      } else {
        console.log(`Finished: ${n_records} csv records, ${n_transformed} transformed, `)
        resolve(n_transformed)
      }
    })

    // count records
    stream.on('data', (data) => {n_records++})
    toEs.on('data', (data) => {n_transformed++})
  })
}


async function saveRecords(esClient, records, index, callback) {
  const body = []

  records.forEach((r) => {
    body.push({ update: { _index: index, _type: 'sat', _id: r.id, _retry_on_conflict: 3 } });
    body.push({ doc: r, doc_as_upsert: true })
  })

  var updated = 0
  var errors = 0

  return esClient.bulk({ body }, (err, resp) => {
    if (err) {
      console.log(err)
    } else {
      if (resp.errors) {
        resp.items.forEach(r => {
          if (r.update.status == 400) {
            console.log(r.update.error.reason)
            errors++
          } else {
            updated++
          }
        })
      } else {
        updated = resp.items.length
      }
      //added = added + resp.items.length
      callback(null, updated, errors)
    }
  })
}


module.exports.client = Client
module.exports.reindex = reindex
module.exports.listIndices = listIndices
module.exports.putMapping = putMapping
module.exports.deleteIndex = deleteIndex
module.exports.streamToEs = streamToEs
module.exports.saveRecords = saveRecords
