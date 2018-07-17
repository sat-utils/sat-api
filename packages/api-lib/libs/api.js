'use strict';

const _ = require('lodash');
const logger = require('./logger');
const queries = require('./queries');

// Search class
function Search(event, esClient) {
  let params = {};

  if (_.has(event, 'query') && !_.isEmpty(event.query)) {
    params = event.query;
  }
  else if (_.has(event, 'body') && !_.isEmpty(event.body)) {
    params = event.body;
  }

  this.headers = event.headers;

  this.merge = false;
  if (_.has(params, 'merge')) {
    this.merge = params.merge;
    params = _.omit(params, ['merge']);
  }

  // get page number
  this.page = parseInt((params.page) ? params.page : 1);

  this.params = params;
  console.log('Search parameters:', params);

  this.size = parseInt((params.limit) ? params.limit : 1);
  this.frm = (this.page - 1) * this.size;
  this.client = esClient;

  this.queries = queries(this.params);

  console.log(`Queries: ${JSON.stringify(this.queries)}`);
}

// search for items using collection and items
Search.prototype.search_items = (callback) => {
  // check collection first
  this.search_collections((err, resp) => {
    const collections = resp.features.map((c) => c.properties['c:id']);
    console.log('matched collections', collections);
    console.log('queries before', JSON.stringify(this.queries));
    let qs;
    if (collections.length === 0) {
      qs = { bool: { must_not: { exists: { field: 'c:id' } } } };
    }
    else {
      qs = collections.map((c) => ({ match: { 'c:id': { query: c } } }));
      qs = { bool: { should: qs } };
    }
    if (!_.has(this.queries.query, 'match_all')) {
      this.queries.query.bool.must.push(qs);
    }
    console.log('queries after', JSON.stringify(this.queries));
    return this.search('items', callback);
  });
};


Search.prototype.search_collections = (callback) => {
  // hacky way to get all collections
  const sz = this.size;
  const frm = this.frm;
  // to ensure all collections get returned
  this.size = 100;
  this.frm = 0;
  // really hacky way to remove geometry from search of collections...temporary
  let geom;
  if (_.has(this.params, 'intersects')) {
    geom = this.params.intersects;
    this.params = _.omit(this.params, 'intersects');
    // redo es queries excluding intersects
    this.queries = queries(this.params);
    console.log('queries after excluding intersects', JSON.stringify(this.queries));
  }
  this.search('collections', (err, resp) => {
    // set sz back to provided parameter
    this.size = sz;
    this.frm = frm;
    if (geom) {
      this.params.intersects = geom;
      // redo es queries including intersects
      this.queries = queries(this.params);
    }
    callback(err, resp);
  });
};


Search.prototype.search = (index, callback) => {
  const self = this;

  const searchParams = {
    index: index,
    body: this.queries,
    size: this.size,
    from: this.frm,
    _source: this.fields
  };

  console.log('Search parameters: ', JSON.stringify(searchParams));

  this.client.search(searchParams).then((body) => {
    console.log(`body: ${JSON.stringify(body)}`);
    const count = body.hits.total;

    const response = {
      type: 'FeatureCollection',
      properties: {
        found: count,
        limit: self.size,
        page: self.page
      },
      features: []
    };

    // get all collections
    //var collections = body.hits.hits.map((c) => {
    //  return c[i]._source.collection
    //})

    response.features = _.range(body.hits.hits.length).map((i) => {
      let props = body.hits.hits[i]._source;
      props = _.omit(props, ['bbox', 'geometry', 'assets', 'links', 'eo:bands']);
      const links = body.hits.hits[i]._source.links || [];
      // add self and collection links
      const host = (
        'X-Forwarded-Host' in self.headers ?
          self.headers['X-Forwarded-Host'] : self.headers.Host
      );
      const apiUrl = `${self.headers['X-Forwarded-Proto']}://${host}`;
      let prefix = '/search/stac';
      if (index === 'collections') {
        prefix = '/collections';
        links.self = { rel: 'self', href: `${apiUrl}${prefix}?c:id=${props.collection}` };
      }
      else {
        links.self = { rel: 'self', href: `${apiUrl}${prefix}?id=${props.id}` };
        if (_.has(props, 'c:id')) {
          links.collection = { href: `${apiUrl}/collections/${props['c:id']}/definition` };
        }
      }
      return {
        type: 'Feature',
        properties: props,
        bbox: body.hits.hits[i]._source.bbox,
        geometry: body.hits.hits[i]._source.geometry,
        assets: body.hits.hits[i]._source.assets,
        links,
        'eo:bands': body.hits.hits[i]._source['eo:bands']
      };
    });

    return callback(null, response);
  }, (err) => {
    logger.error(err);
    return callback(err);
  });
};


module.exports = Search;
