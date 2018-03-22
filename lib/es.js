'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')


async function connect() {
  let esConfig
  let client

  // use local client
  if (!process.env.ES_HOST) {
    client = new elasticsearch.Client({host: 'localhost:9200'})
    //return client
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
              cloud_coverage: { type: 'float' },
              date: { type: 'date' },
              data_geometry: {
                type: 'geo_shape',
                tree: 'quadtree',
                precision: '5mi'
              }
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

async function saveRecords(esClient, records, callback, index=process.env.ES_INDEX) {
  const body = []

  records.forEach((r) => {
    body.push({ update: { _index: index, _type: r.satellite_name, _id: r.scene_id, _retry_on_conflict: 3 } });
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

module.exports.reindex = reindex
module.exports.connect = connect
module.exports.listIndices = listIndices
module.exports.putMapping = putMapping
module.exports.deleteIndex = deleteIndex
module.exports.saveRecords = saveRecords
