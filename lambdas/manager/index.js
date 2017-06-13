'use strict';

const es = require('../../lib/es');

module.exports.handler = function (event, context, cb) {
  es.connect().then((client) => {
    if (event.index && event.action) {
      if (event.action === 'putMapping') {
        return es.putMapping(client, event.index);
      }
      else if (event.action === 'deleteIndex') {
        return es.deleteIndex(client, event.index);
      }
      else if (event.action === 'listIndices') {
        return es.listIndices(client, event.index);
      }
      else if (event.action === 'reindex') {
        return es.reindex(client, event.source, event.dest);
      }
    }
  }).then(r => cb(null, r))
    .catch(e => cb(e));
};
