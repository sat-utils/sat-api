const AWS = require('aws-sdk')
const httpAwsEs = require('http-aws-es')
const elasticsearch = require('elasticsearch')

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

function buildQuery(query) {
  const must = Object.keys(query).reduce((accumulator, property) => {
    const queryOperators = query[property]
    Object.keys(queryOperators).forEach((operator) => {
      if (operator === 'eq') {
        const termQuery = { term: { [`properties.${property}`]: queryOperators.eq } }
        accumulator.push(termQuery)
      }
    })
    return accumulator
  }, [])

  const queryBody = {
      constant_score: {
        filter: {
          bool: {
            must
          }
        }
      }
    }
  //const query = {
    //constant_score: {
      //filter: {
        //terms: {
          //'properties.collection': ['landsat-8-l1', 'collection2']
        //}
      //}
    //}
  //}
  return { query: queryBody }
}

async function search(params, index = '*', page, limit) {
  const searchParams = {
    index,
    body: buildQuery(params),
    size: limit,
    from: (page - 1) * limit
  }

  const client = await esClient()
  const body = await client.search(searchParams)
  console.log(body)
  //const results = body.hits.hits.map((r) => (r._source))
  //const response = {
    //results,
    //meta: {
      //page,
      //limit,
      //found: body.hits.total,
      //returned: results.length
    //}
  //}
}

const params = {
  query: {
    collection: {
      eq: 'landsat-8-l1'
    }
  }
}
search(params.query, 'items', 1, 10)
