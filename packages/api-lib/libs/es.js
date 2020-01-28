'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('./ElasticSearchWriteableStream')
const logger = console //require('./logger')

let _esClient
/*
This module is used for connecting to an Elasticsearch instance, writing records,
searching records, and managing the indexes. It looks for the ES_HOST environment
variable which is the URL to the elasticsearch host
*/

// Connect to an Elasticsearch instance
async function connect() {
  let esConfig

  // use local client
  if (!process.env.ES_HOST) {
    esConfig = {
      host: 'localhost:9200'
    }
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
  }

  logger.debug(`Elasticsearch config: ${JSON.stringify(esConfig)}`)
  const client = new elasticsearch.Client(esConfig)

  await new Promise((resolve, reject) => client.ping({ requestTimeout: 1000 },
    (err) => {
      if (err) {
        reject(`Unable to connect to elasticsearch: ${err}`)
      } else {
        resolve()
      }
    }))
  return client
}

// get existing ES client or create a new one
async function esClient() {
  if (!_esClient) {
    try {
      _esClient = await connect()
    } catch (error) {
      logger.error(error)
    }
    if (_esClient) {
      logger.debug('Connected to Elasticsearch')
    }
  } else {
    logger.debug('Using existing Elasticsearch connection')
  }
  return _esClient
}

// Create STAC mappings
async function prepare(index) {
  // TODO - different mappings for collection and item
  const props = {
    'type': 'object',
    properties: {
      'datetime': { type: 'date' },
      'created': { type: 'date' },
      'updated': { type: 'date' },
      'eo:cloud_cover': { type: 'float' },
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

  const dynamicTemplates = [{
    strings: {
      mapping: {
        type: 'keyword'
      },
      match_mapping_type: 'string'
    }
  }]
  const client = await esClient()
  const indexExists = await client.indices.exists({ index })
  if (!indexExists) {
    const precision = process.env.SATAPI_ES_PRECISION || '5mi'
    const payload = {
      index,
      body: {
        mappings: {
          doc: {
            /*'_all': {
                enabled: true
            },*/
            dynamic_templates: dynamicTemplates,
            properties: {
              'id': { type: 'keyword' },
              'collection': { type: 'keyword' },
              'properties': props,
              geometry: {
                type: 'geo_shape',
                tree: 'quadtree',
                precision: precision
              }
            }
          }
        }
      }
    }
    try {
      await client.indices.create(payload)
      logger.info(`Created index: ${JSON.stringify(payload)}`)
    } catch (error) {
      const debugMessage = `Error creating index, already created: ${error}`
      logger.debug(debugMessage)
    }
  }
}

// Given an input stream and a transform, write records to an elasticsearch instance
async function _stream() {
  let esStreams
  try {
    let collections = []
    const client = await esClient()
    const indexExists = await client.indices.exists({ index: 'collections' })
    if (indexExists) {
      const body = { query: { match_all: {} } }
      const searchParams = {
        index: 'collections',
        body
      }
      const resultBody = await client.search(searchParams)
      collections = resultBody.hits.hits.map((r) => (r._source))
    }

    const toEs = through2.obj({ objectMode: true }, (data, encoding, next) => {
      let index = ''
      if (data && data.hasOwnProperty('extent')) {
        index = 'collections'
      } else if (data && data.hasOwnProperty('geometry')) {
        index = 'items'
      } else {
        next()
        return
      }
      // remove any hierarchy links in a non-mutating way
      const hlinks = ['self', 'root', 'parent', 'child', 'collection', 'item']
      const links = data.links.filter((link) => hlinks.includes(link))
      let esDataObject = Object.assign({}, data, { links })
      if (index === 'items') {
        const collectionId = data.collection
        const itemCollection =
          collections.find((collection) => (collectionId === collection.id))
        if (itemCollection) {
          const flatProperties =
            Object.assign({}, itemCollection.properties, data.properties)
          flatProperties.created = new Date().toISOString()
          flatProperties.updated = new Date().toISOString()
          esDataObject = Object.assign({}, esDataObject, { properties: flatProperties })
        } else {
          logger.error(`${data.id} has no collection`)
        }
      }

      // create ES record
      const record = {
        index,
        type: 'doc',
        id: esDataObject.id,
        action: 'update',
        _retry_on_conflict: 3,
        body: {
          doc: esDataObject,
          doc_as_upsert: true
        }
      }
      next(null, record)
    })
    const esStream = new ElasticsearchWritableStream({ client: client }, {
      objectMode: true,
      highWaterMark: process.env.ES_BATCH_SIZE || 500
    })
    esStreams = { toEs, esStream }
  } catch (error) {
    logger.error(error)
  }
  return esStreams
}

function buildRangeQuery(property, operators, operatorsObject) {
  const gt = 'gt'
  const lt = 'lt'
  const gte = 'gte'
  const lte = 'lte'
  const comparisons = [gt, lt, gte, lte]
  let rangeQuery
  if (operators.includes(gt) || operators.includes(lt) ||
         operators.includes(gte) || operators.includes(lte)) {
    const propertyKey = `properties.${property}`
    rangeQuery = {
      range: {
        [propertyKey]: {
        }
      }
    }
    // All operators for a property go in a single range query.
    comparisons.forEach((comparison) => {
      if (operators.includes(comparison)) {
        const exisiting = rangeQuery.range[propertyKey]
        rangeQuery.range[propertyKey] = Object.assign({}, exisiting, {
          [comparison]: operatorsObject[comparison]
        })
      }
    })
  }
  return rangeQuery
}

function buildDatetimeQuery(parameters) {
  let dateQuery
  const { datetime } = parameters
  if (datetime) {
    const dataRange = datetime.split('/')
    if (dataRange.length === 2) {
      dateQuery = {
        range: {
          'properties.datetime': {
            gte: dataRange[0],
            lte: dataRange[1]
          }
        }
      }
    } else {
      dateQuery = {
        term: {
          'properties.datetime': datetime
        }
      }
    }
  }
  return dateQuery
}

function buildQuery(parameters) {
  const eq = 'eq'
  const inop = 'in'
  const { query, intersects, collections } = parameters
  let must = []
  if (query) {
    // Using reduce rather than map as we don't currently support all
    // stac query operators.
    must = Object.keys(query).reduce((accumulator, property) => {
      const operatorsObject = query[property]
      const operators = Object.keys(operatorsObject)
      if (operators.includes(eq)) {
        const termQuery = {
          term: {
            [`properties.${property}`]: operatorsObject.eq
          }
        }
        accumulator.push(termQuery)
      } else if (operators.includes(inop)) {
        const termsQuery = {
          terms: {
            [`properties.${property}`]: operatorsObject.in
          }
        }
        accumulator.push(termsQuery)
      }
      const rangeQuery =
        buildRangeQuery(property, operators, operatorsObject)
      if (rangeQuery) {
        accumulator.push(rangeQuery)
      }
      return accumulator
    }, must)
  }

  if (collections) {
    must.push({
      terms: {
        'collection': collections
      }
    })
  }

  if (intersects) {
    must.push({
      geo_shape: {
        geometry: { shape: intersects }
      }
    })
  }

  const datetimeQuery = buildDatetimeQuery(parameters)
  if (datetimeQuery) {
    must.push(datetimeQuery)
  }

  const filter = { bool: { must } }
  const queryBody = {
    constant_score: { filter }
  }
  return { query: queryBody }
}

function buildIdQuery(id) {
  return {
    query: {
      constant_score: {
        filter: {
          term: {
            id
          }
        }
      }
    }
  }
}

function buildIdsQuery(ids) {
  return {
    query: {
      ids: {
        values: ids
      }
    }
  }
}

function buildSort(parameters) {
  const { sort } = parameters
  let sorting
  if (sort && sort.length > 0) {
    sorting = sort.map((sortRule) => {
      const { field, direction } = sortRule
      const propertyKey = `properties.${field}`
      return {
        [propertyKey]: {
          order: direction
        }
      }
    })
  } else {
    // Default item sorting
    sorting = [
      { 'properties.datetime': { order: 'desc' } }
    ]
  }
  return sorting
}

/*
function buildFieldsFilter(parameters) {
  const { fields } = parameters
  let _sourceInclude = [
    'id',
    'type',
    'geometry',
    'bbox',
    'links',
    'assets',
    'collection',
    'properties.datetime'
  ]
  let _sourceExclude = []
  if (fields) {
    const { include, exclude } = fields
    // Remove exclude fields from the default include list and add them to the source exclude list
    if (exclude && exclude.length > 0) {
      _sourceInclude = _sourceInclude.filter((field) => !exclude.includes(field))
      _sourceExclude = exclude
    }
    // Add include fields to the source include list if they're not already in it
    if (include && include.length > 0) {
      include.forEach((field) => {
        if (_sourceInclude.indexOf(field) < 0) {
          _sourceInclude.push(field)
        }
      })
    }
  }
  return { _sourceInclude, _sourceExclude }
}
*/

async function search(parameters, index = '*', page = 1, limit = 10) {
  let body
  if (parameters.ids) {
    const { ids } = parameters
    body = buildIdsQuery(ids)
  } else if (parameters.id) {
    const { id } = parameters
    body = buildIdQuery(id)
  } else {
    body = buildQuery(parameters)
  }
  const sort = buildSort(parameters)
  body.sort = sort
  logger.info(`Elasticsearch query: ${JSON.stringify(body)}`)

  const searchParams = {
    index,
    body,
    size: limit,
    from: (page - 1) * limit
  }

  /* disable fields filter for now
  const { _sourceInclude, _sourceExclude } = buildFieldsFilter(parameters)
  if (_sourceExclude.length > 0) {
    searchParams._sourceExclude = _sourceExclude
  }
  if (_sourceInclude.length > 0) {
    searchParams._sourceInclude = _sourceInclude
  }
  */

  const client = await esClient()
  const resultBody = await client.search(searchParams)
  const results = resultBody.hits.hits.map((r) => (r._source))
  const response = {
    results,
    'search:metadata': {
      next: (((page * limit) < resultBody.hits.total) ? page + 1 : null),
      limit,
      matched: resultBody.hits.total,
      returned: results.length
    }
  }
  return response
}

module.exports.prepare = prepare
module.exports.stream = _stream
module.exports.search = search
