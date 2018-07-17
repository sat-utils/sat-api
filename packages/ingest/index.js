'use strict';

const satlib = require('@sat-utils/api-lib');
const _ = require('lodash');

/* Example Handler
{
  'satellite': 'landsat',
  'arn': *arn of step function to do transform*,


}
*/
module.exports.handler = function handler(event, context, cb) {
  console.log('ingest event: ', JSON.stringify(event));
  const sat = event.satellite;
  const bucket = process.env.bucket || 'sat-api';
  let key = process.env.prefix || 'sat-api-dev';
  key = `${key}/ingest/${sat}/`;
  const maxFiles = _.get(event, 'maxFiles', 0);
  const linesPerFile = _.get(event, 'linesPerFile', 500);
  const maxLambdas = _.get(event, 'maxLambdas', 30);
  const arn = _.get(event, 'arn', '');

  let url;
  const reverse = true;
  switch (sat) {
  case 'landsat':
    url = 'https://landsat.usgs.gov/landsat/metadata_service/bulk_metadata_files/LANDSAT_8_C1.csv';
    break;
  case 'sentinel':
    url = 'https://storage.googleapis.com/gcp-public-data-sentinel-2/index.csv.gz';
    break;
  default:
    return cb('no match was found for satellite');
  }

  return satlib.ingestcsv.split({
    url,
    bucket,
    key,
    arn,
    maxFiles,
    linesPerFile,
    maxLambdas,
    reverse,
    cb
  });
};

