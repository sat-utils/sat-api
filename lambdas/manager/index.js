'use strict';

const satlib = require('sat-api-lib')

module.exports.handler = function (event, context, cb) {
  satlib.es.client().then((client) => {
    if (event.action === 'putMapping') {
      return satlib.es.putMapping(client, event.index);
    }
    else if (event.action === 'deleteIndex') {
      return satlib.es.deleteIndex(client, event.index);
    }
    else if (event.action === 'listIndices') {
      return satlib.es.listIndices(client, event.index);
    }
    else if (event.action === 'reindex') {
      return satlib.es.reindex(client, event.source, event.dest);
    }
    else if (event.action === 'createRepo') {
      let settings = {
        bucket: process.env.BUCKET,
        role_arn: process.env.ROLE_ARN,
      }
      if (process.env.AWS_REGION == 'us-east-1') {
        settings.endpoint = 's3.amazonaws.com'
      } else {
        settings.region = process.env.AWS_REGION
      }
      console.log('settings', settings)
      return client.snapshot.createRepository({
        repository: 'sat-api',
        body: {type: 's3', settings},
      })
    } else if (event.action === 'takeSnapshot') {
      client.snapshot.create({
        repository: 'sat-api',
        snapshot: event.snapshot,
        body: {
          indices: 'collections,items'
        }
      }).then(resp => {
        console.log(resp)
      })
    }
  }).then(r => cb(null, r))
    .catch(e => cb(e));
};
