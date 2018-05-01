'use strict'
const ingest = require('../../lib/ingest-csv')
const local = require('kes/src/local')

module.exports.handler = function (event, context, cb) {
  ingest.split(event.satellite, event.arn, event.maxFiles, event.linesPerFile, event.maxLambdas, cb)
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
