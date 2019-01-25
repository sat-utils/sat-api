'use strict'

const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const through2 = require('through2')
const ElasticsearchWritableStream = require('./ElasticSearchWriteableStream')
const logger = require('./logger')

let _esClient
// Query constants
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

  await new Promise((resolve, reject) => client.ping({ requestTimeout: 1000 },
    (err) => {
      if (err) {
        reject('Unable to connect to elasticsearch')
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
  let ready
  const props = {
    'type': 'object',
    properties: {
      'collection': { type: 'keyword' },
      'datetime': { type: 'date' },
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
    try {
      await client.indices.create(payload)
      logger.info(`Created index: ${JSON.stringify(payload)}`)
      ready = 0
    } catch (error) {
      const debugMessage = `Error creating index, already created: ${error}`
      logger.debug(debugMessage)
    }
  }
  return ready
}

// Given an input stream and a transform, write records to an elasticsearch instance
async function _stream() {
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
    const dataNoLinks = Object.assign({}, data, { links })

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
  let esStreams
  try {
    const client = await esClient()
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
            gt: dataRange[0],
            lt: dataRange[1]
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

// We need to filter collections using any combination of fields they have
function filterCollections(parameters, collections) {
  const { query } = parameters
  const queryPropKeys = Object.keys(query)
  const filteredCollections = collections.filter((collection) => {
    const { properties } = collection
    const collectionPropKeys = Object.keys(properties)
    const commonPropKeys = collectionPropKeys
      .filter((prop) => queryPropKeys.includes(prop))
    const eq = 'eq'
    const gt = 'gt'
    const lt = 'lt'
    const gte = 'gte'
    const lte = 'lte'
    const propertyChecks = commonPropKeys.map((property) => {
      const collectionProperty = properties[property]
      const operatorsObject = query[property]
      const operators = Object.keys(operatorsObject)
      const operatorChecks = operators.map((operator) => {
        let valid = false
        if (operator === eq) {
          valid = collectionProperty === operatorsObject[operator]
        }
        if (operator === gt) {
          valid = collectionProperty > operatorsObject[operator]
        }
        if (operator === lt) {
          valid = collectionProperty < operatorsObject[operator]
        }
        if (operator === gte) {
          valid = collectionProperty >= operatorsObject[operator]
        }
        if (operator === lte) {
          valid = collectionProperty <= operatorsObject[operator]
        }
        return valid
      })
      const allOperatorsValid = !operatorChecks.includes(false)
      return allOperatorsValid
    })
    const allPropertiesValid = !propertyChecks.includes(false)
    return allPropertiesValid
  })
  return filteredCollections
}

function buildQuery(parameters) {
  const { query, parentCollections, intersects } = parameters
  let must = []
  const eq = 'eq'
  if (query) {
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
      }
      const rangeQuery =
        buildRangeQuery(property, operators, operatorsObject)
      if (rangeQuery) {
        accumulator.push(rangeQuery)
      }
      return accumulator
    }, must)
  }
  if (intersects) {
    const { geometry } = intersects
    must.push({
      geo_shape: {
        geometry: { shape: geometry }
      }
    })
  }

  const datetimeQuery = buildDatetimeQuery(parameters)
  if (datetimeQuery) {
    must.push(datetimeQuery)
  }

  let filter
  if (parentCollections && parentCollections.length !== 0) {
    filter = {
      bool: {
        should: [
          { terms: { 'properties.collection': parentCollections } },
          { bool: { must } }
        ]
      }
    }
  } else {
    filter = { bool: { must } }
  }
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

async function search(parameters, index = '*', page = 1, limit = 10) {
  const client = await esClient()
  let response
  if (index === 'items') {
    let body
    const { id } = parameters
    if (id) {
      body = buildIdQuery(id)
    } else {
      body = buildQuery(parameters)
    }
    const sort = buildSort(parameters)
    body.sort = sort
    const searchParams = {
      index,
      body,
      size: limit,
      from: (page - 1) * limit
    }
    const resultBody = await client.search(searchParams)
    const results = resultBody.hits.hits.map((r) => (r._source))
    console.log(results)
    response = {
      results,
      meta: {
        page,
        limit,
        found: resultBody.hits.total,
        returned: results.length
      }
    }
  }
  // We return all collections from ES and then filter them locally.
  if (index === 'collections') {
    const arbitraryLimit = 5000
    const body = { query: { match_all: {} } }
    const searchParams = {
      index,
      body
    }
    const resultBody = await client.search(searchParams)
    const results = resultBody.hits.hits.map((r) => (r._source))
    const { id, query } = parameters
    let filteredResults
    if (id) {
      filteredResults = results.filter((result) => (result.id === id))
    }
    if (query) {
      filteredResults = filterCollections(parameters, results)
    }
    response = {
      results: filteredResults,
      meta: {
        page: 1,
        limit: arbitraryLimit,
        found: resultBody.hits.total,
        returned: filteredResults.length
      }
    }
  }
  return response
}


module.exports.prepare = prepare
module.exports.stream = _stream
module.exports.search = search
module.exports.filterCollections = filterCollections
