'use strict';

const get = require('lodash.get');
const csv = require('fast-csv');
const AWS = require('aws-sdk');
const queue = require('async.queue');
const es = require('./es');

let esClient;

function pushToEs(records, callback) {
  //callback(null);
  es.saveRecords(esClient, records).then(() => callback()).catch(e => callback(e));
}

function processCsvFile(bucket, key, transform) {
  // batch processing config

  const q = queue(pushToEs, 2);
  const allScenes = [];
  const batchSize = 400;
  let bufferArray = [];

  // download the csv file
  const s3 = new AWS.S3();
  const params = {
    Bucket: bucket,
    Key: key
  };
  console.log(`starting processing ${key}`);

  const csvStream = csv.parse({ headers: true, objectMode: true });
  s3.getObject(params).createReadStream().pipe(csvStream);

  return new Promise((resolve, reject) => {
    csvStream.on('data', (data) => {
      transform(data, (e, record) => {
        if (e) {
          console.log(e);
          return;
        }
        if (bufferArray.length >= batchSize) {
          q.push([bufferArray.slice()], e => console.log(e));
          bufferArray = [];
        }

        allScenes.push(record.scene_id);
        bufferArray.push(record);
      });
    });

    csvStream.on('end', () => {
      // push remaning records to kinesis
      if (bufferArray.length > 0) {
        q.push([bufferArray.slice()], e => console.log(e));
      }
    });

    q.drain = () => resolve(allScenes.length);
    csvStream.on('error', e => reject(e));
  });
}

function prepare(event, transform, cb) {
  const bucket = get(event, 'bucket');
  const key = get(event, 'key');
  const direction = get(event, 'direction', 'asc');
  const satellite = get(event, 'satellite', 'landsat');
  const currentFileNum = get(event, 'currentFileNum', 0);
  const lastFileNum = get(event, 'lastFileNum', 0);
  const arn = get(event, 'arn');

  let nextKey;
  let nextFileNum;
  const currentKey = `${key}/${satellite}_${currentFileNum}.csv`;

  if (direction === 'desc') {
    if (currentFileNum > lastFileNum) {
      nextKey = `${key}/${satellite}_${currentFileNum - 1}.csv`;
      nextFileNum = currentFileNum - 1;
    }
  }
  else {
    if (currentFileNum < lastFileNum) {
      nextKey = `${key}/${satellite}_${currentFileNum + 1}.csv`;
      nextFileNum = currentFileNum + 1;
    }
  }

  processCsvFile(
    bucket, currentKey, transform
  ).then((scenes) => {
    if (nextKey) {
      const stepfunctions = new AWS.StepFunctions();
      const params = {
        stateMachineArn: arn,
        input: JSON.stringify({ bucket, key, satellite, currentFileNum: nextFileNum, lastFileNum, arn, direction }),
        name: `csv_${satellite}_${nextFileNum}_${Date.now()}`
      };
      stepfunctions.startExecution(params, function(err, data) {
        cb(err, `launched ${JSON.stringify(params)}`);
      });
    }
    else {
      cb(null, scenes);
    }
  }).catch(e => cb(e));
}

function update(event, transform, cb) {
  if (!esClient) {
    es.connect().then((client) => {
      esClient = client;
      prepare(event, transform, cb);
    });
  }
  else {
    prepare(event, transform, cb);
  }
}

module.exports.update = update;
