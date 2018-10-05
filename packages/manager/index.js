'use strict'

const satlib = require('@sat-utils/api-lib')

module.exports.handler = function hander(event, context, cb) {
  let esClient
  return satlib.es.client().then((client) => {
    esClient = client
    if (event.action === 'deleteIndex') {
      return satlib.es.deleteIndex(esClient, event.index)
    }
    else if (event.action === 'reindex') {
      return satlib.es.reindex(esClient, event.source, event.dest)
    }
    /* WIP code for making copy of es instance
    else if (event.action === 'createRepo') {
      const settings = {
        bucket: process.env.BUCKET,
        role_arn: process.env.ROLE_ARN
      }
      if (process.env.AWS_REGION === 'us-east-1') {
        settings.endpoint = 's3.amazonaws.com'
      }
      else {
        settings.region = process.env.AWS_REGION
      }
      console.log('settings', settings)
      return esClient.snapshot.createRepository({
        repository: 'sat-api',
        body: { type: 's3', settings }
      })
    }
    else if (event.action === 'takeSnapshot') {
      return esClient.snapshot.create({
        repository: 'sat-api',
        snapshot: event.snapshot,
        body: {
          indices: 'collections,items'
        }
      }).then(console.log)
    }
    */

    return cb('No supported action was found')
  })
    .then((r) => cb(null, r))
    .catch(cb)
}
