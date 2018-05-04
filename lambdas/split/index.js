'use strict'
const satlib = require('sat-api-lib')
const local = require('kes/src/local')

/* Example Handler
{
  'satellite': 'landsat',
  'arn': '...',


}
*/

module.exports.handler = function (event, context, cb) {
  const sat = event.satellite
  const bucket = process.env.bucket || 'sat-api'
  let key = process.env.prefix || 'sat-api-dev'
  key = `${key}/csv/${sat}/${sat}`;
  let reverse = false

  switch (sat) {
    case 'landsat':
      url = 'https://landsat.usgs.gov/landsat/metadata_service/bulk_metadata_files/LANDSAT_8_C1.csv'
      break
    case 'sentinel':
      url = 'https://storage.googleapis.com/gcp-public-data-sentinel-2/index.csv.gz'
      reverse = true
      break
  }

  satlib.ingest.split({url, bucket, key, arn: event.arn, maxFiles: event.maxFiles,
                linesPerFile: event.linesPerFile, maxLambdas: event.maxLambdas, reverse, cb})
}

local.localRun(() => {
  const payload = {
    satellite: 'landsat',
    arn: '',
    maxFiles: 1,
  }

  module.exports.handler(payload, null, (e, r) => {
    console.log(e, r)
  })
})
