'use strict';

const AWS = require('aws-sdk');
const httpAwsEs = require('http-aws-es');
const elasticsearch = require('elasticsearch');
const index = `${process.env.StackName}-${process.env.Stage}-sat-api`;

async function connect() {
  let esConfig;

  if (process.env.MODE === 'local') {
    esConfig = {
      host: process.env.ES_HOST || 'localhost:9200'
    };

    const client = new elasticsearch.Client(esConfig);
    return client;
  }

  await new Promise((resolve, reject) => AWS.config.getCredentials((err) => {
    if (err) return reject(err);
    resolve();
  }));

  esConfig = {
    host: process.env.ES_HOST || 'localhost:9200',
    connectionClass: httpAwsEs,
    amazonES: {
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      credentials: AWS.config.credentials
    },

    // Note that this doesn't abort the query.
    requestTimeout: 50000  // milliseconds
  };

  const client = new elasticsearch.Client(esConfig);
  return client;
}

async function listIndices(esClient, index) {
  return esClient.indices.get({ index });
}

async function putMapping(esClient, index) {
  // make sure the index doesn't exist
  const exist = await esClient.indices.exists({ index });
  if (!exist) {
    console.log(`Creating index: ${index}`);
    return esClient.indices.create({
      index,
      body: {
        mappings: {
          '_default_': {
            '_all': {
              enabled: true
            },
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
    });
  }
  throw new Error('The index is already created. Can\'t put mapping');
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
  });
}

//async function deleteIndex(esClient, index) {
  //return esClient.indices.delete({ index });
//}

async function saveRecords(esClient, records, callback) {
  const body = [];

  records.forEach((r) => {
    body.push({ update: { _index: process.env.ES_INDEX, _type: r.satellite_name, _id: r.scene_id, _retry_on_conflict: 3 } });
    body.push({ doc: r, doc_as_upsert: true });
  });

  return esClient.bulk({ body });
}

module.exports.index = index;
module.exports.reindex = reindex;
module.exports.connect = connect;
module.exports.listIndices = listIndices;
module.exports.putMapping = putMapping;
//module.exports.deleteIndex = deleteIndex;
module.exports.saveRecords = saveRecords;
