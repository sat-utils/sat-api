'use strict';

const satlib = require('sat-api-lib')

module.exports.handler = function (event, context, cb) {
  satlib.es.client().then((client) => {
    if (event.index && event.action) {
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
    }
  }).then(r => cb(null, r))
    .catch(e => cb(e));
};
