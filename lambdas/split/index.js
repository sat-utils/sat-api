'use strict';

const got = require('got');
const stream = require('stream');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const local = require('kes/src/local');

const stepfunctions = new AWS.StepFunctions();
const s3 = new AWS.S3();

function split(satellite, arn, maxFiles, linesPerFile, cb) {
  const lineBuffer = new Buffer(4096);
  const gunzip = zlib.createGunzip();
  let remoteCsv;
  let newStream;
  let fileCounter = 0;
  let header;
  linesPerFile = linesPerFile || 10000;
  let lineCounter = 0;
  let lineLength = 0;
  let currentFile;
  let stopSplitting = false;
  const bucket = process.env.bucket || 'sat-api';
  const prefix = process.env.prefix || 'sat-api-dev';

  switch (satellite) {
    case 'landsat':
      remoteCsv = 'https://landsat.usgs.gov/landsat/metadata_service/bulk_metadata_files/LANDSAT_8_C1.csv';
      newStream = got.stream(remoteCsv);
      break;
    case 'sentinel':
      remoteCsv = 'https://storage.googleapis.com/gcp-public-data-sentinel-2/index.csv.gz';
      newStream = got.stream(remoteCsv).pipe(gunzip);
      break;
  }

  const build = function buildFile(line) {
    if (!stopSplitting) {
      const fileName = `${prefix}/csv/${satellite}/${satellite}_${fileCounter}.csv`;

      // get the csv header
      if (fileCounter === 0 && lineCounter === 0) {
        header = line.toString();
      }

      if (lineCounter === 0) {
        currentFile = new stream.PassThrough();
        currentFile.push(header);
      }
      else {
        currentFile.push(line.toString());
      }

      lineCounter += 1; // increment the filename
      lineLength = 0; // reset the buffer

      if (lineCounter > linesPerFile) {
        const params = {
          Body: currentFile,
          Bucket: bucket,
          Key: fileName
        };

        s3.upload(params, (e, d) => console.log(e, d));
        currentFile.end();
        console.log(`uploaded ${fileName}`)

        lineCounter = 0; // start counting the lines again
        fileCounter += 1;
      }

      // sentinel csv is ordered from old to new
      // so we always have to go all the way back
      if (fileCounter >= maxFiles && satellite !== 'sentinel') {
        stopSplitting = true;
        console.log(`Stop splitting files at ${fileCounter}`);
      }
    }
  };

  newStream.on('data', (data) => {
    if (!stopSplitting) {
      const dataLen = data.length;
      for (let i = 0; i < dataLen; i++) {
        lineBuffer[lineLength] = data[i]; // Buffer new line data.
        lineLength++;
        if (data[i] === 10) { // Newline char was found.
          build(lineBuffer.slice(0, lineLength));
        }
      }
    }
  });

  newStream.on('end', () => {
    currentFile.end();
    let last = fileCounter - 1;
    let first = 0;
    let direction = 'asc';

    if (satellite === 'sentinel') {
      first = fileCounter - 1;
      last = fileCounter - maxFiles;
      if (last < 0) last = 0;
      direction = 'desc';
    }

    const params = {
      stateMachineArn: arn,
      input: JSON.stringify({
        bucket,
        key: `${prefix}/csv/${satellite}`,
        satellite,
        currentFileNum: first,
        lastFileNum: last,
        direction,
        arn
      }),
      name: `csv_${satellite}_0_${Date.now()}`
    };
    stepfunctions.startExecution(params, function(err, data) {
      console.log('step function launched');
      return cb(err, data);
    });
  });
  newStream.on('error', e => cb(e));
}

module.exports.handler = function (event, context, cb) {
  split(event.satellite, event.arn, event.maxFiles, event.linesPerFile, cb);
};

local.localRun(() => {
  const payload = {
    satellite: 'landsat',
    arn: 'arn:aws:states:us-east-1:552819999234:stateMachine:LandsatMetadataProcessorStateMachine-W8QZOZF1E6WN',
    maxFiles: 1
  };

  module.exports.handler(payload, null, (e, r) => {
    console.log(e, r);
  });
});
