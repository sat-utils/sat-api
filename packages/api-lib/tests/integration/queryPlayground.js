const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')
const geojson = require('../fixtures/stac/noIntersectsFeature.json')

process.env.ES_HOST = 'http://192.168.99.100:4571'

let _esClient
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

function buildQuery(parameters) {
  const eq = 'eq'
  const { query, parentCollections, intersects } = parameters
  let must = []
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
        buildRangeQuery(accumulator, property, operators, operatorsObject)
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

async function search(parameters, index = '*', page, limit) {
  let body
  if (parameters.id) {
    const { id } = parameters
    body = buildIdQuery(id)
  } else {
    body = buildQuery(parameters)
  }
  const searchParams = {
    index,
    body,
    size: limit,
    from: (page - 1) * limit
  }

  const client = await esClient()
  const result = await client.search(searchParams)
  console.log(result)
}

const parameters = {
  //parentCollections: ['collection2'],
  //id: 'collection2',
  //intersects: geojson,
  datetime: '2015-03-22/2016-01-01',
  query: {
    collection: {
      eq: 'landsat-8-l1'
    }
    //'eo:cloud_cover': {
      //gt: 8,
      //lte: 8.26
    //},
    //'eo:sun_azimuth': {
      //gt: 174
    //}
  }
}
search(parameters, 'items', 1, 10)
