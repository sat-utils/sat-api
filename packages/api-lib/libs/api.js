'use strict';

var _ = require('lodash')
var moment = require('moment')
var area = require('turf-area')
var intersect = require('turf-intersect')
var logger = require('./logger')
var queries = require('./queries')

// converts string intersect to js object
var intersectsToObj = function (intersects) {
  if (_.isString(intersects)) {
    try {
      intersects = JSON.parse(intersects);
    } catch (e) {
      throw new Error('Invalid Geojson');
    }
  }

  return intersects;
}


// Search class
function Search(event, esClient) {
  var params = {}

  if (_.has(event, 'query') && !_.isEmpty(event.query)) {
    params = event.query
  } else if (_.has(event, 'body') && !_.isEmpty(event.body)) {
    params = event.body
  }

  this.headers = event.headers

  // AOI Coverage
  /*this.aoiCoverage = null;
  if (_.has(params, 'coverage')) {
    this.aoiCoverage = params['coverage']
    params = _.omit(params, ['coverage'])
  }*/

  this.merge = false
  if (_.has(params, 'merge')) {
    this.merge = params['merge']
    params = _.omit(params, ['merge'])
  }  

  // get page number
  this.page = parseInt((params.page) ? params.page : 1)

  this.params = params
  console.log('Search parameters:', params)

  this.size = parseInt((params.limit) ? params.limit : 1)
  this.frm = (this.page - 1) * this.size
  this.client = esClient

  this.queries = queries(this.params)

  console.log(`Queries: ${JSON.stringify(this.queries)}`)
}


/*var aoiCoveragePercentage = function (feature, scene, aoiArea) {
  var intersectObj = intersect(feature, scene);
  if (intersectObj === undefined) {
    return 0;
  }

  var intersectArea = area(intersectObj);
  var percentage = (intersectArea / aoiArea) * 100;

  return percentage;
}


Search.prototype.calculateAoiCoverage = function (response) {
  var self = this;
  if (this.aoiCoverage && _.has(this.params, 'intersects')) {
    this.params.intersects = intersectsToObj(this.params.intersects);
    var coverage = parseFloat(this.aoiCoverage);
    var newResponse = [];
    var aoiArea = area(self.params.intersects);

    response.forEach(function (r) {
      var gj = self.params.intersects;
      var percentage = 0;

      if (gj.type === 'FeatureCollection') {
        gj.features.forEach(function (f) {
          percentage += aoiCoveragePercentage(f.geometry, r.data_geometry, aoiArea);
        });
      } else if (gj.type === 'Feature') {
        percentage = aoiCoveragePercentage(gj.geometry, r.data_geometry, aoiArea);
      } else if (gj.type === 'Polygon') {
        percentage = aoiCoveragePercentage(gj, r.data_geometry, aoiArea);
      }

      if (percentage >= coverage) {
        newResponse.push(r);
      }
    });

    return newResponse;
  } else {
    return response;
  }
}*/


// search for items using collection and items
Search.prototype.search_items = function(callback) {
  // check collection first
  this.search_collections((err, resp) => {
    var collections = resp.features.map((c) => {
      return c.properties['c:id']
    })
    console.log('matched collections', collections)
    console.log('queries before', JSON.stringify(this.queries))
    var qs
    if (collections.length === 0) {
      qs = {bool: {must_not: {exists: {'field': 'c:id'}}}}  
    } else {
      qs = collections.map((c) => { return {"match": {"c:id": {"query": c}}} })
      qs = {bool: {should: qs}}
    }
    if (!this.queries.query.hasOwnProperty('match_all')) {
      this.queries.query.bool.must.push(qs)
    }
    console.log('queries after', JSON.stringify(this.queries))
    return this.search('items', callback)
  })
}


Search.prototype.search_collections = function (callback) {
  // hacky way to get all collections
  var sz = this.size
  var frm = this.frm
  // to ensure all collections get returned
  this.size = 100
  this.frm = 0
  // really hacky way to remove geometry from search of collections...temporary
  var geom
  if (this.params.hasOwnProperty('intersects')) {
    geom = this.params.intersects
    this.params = _.omit(this.params, 'intersects')
    // redo es queries excluding intersects
    this.queries = queries(this.params)
    console.log('queries after excluding intersects', JSON.stringify(this.queries))
  }
  this.search('collections', (err, resp) => {
    // set sz back to provided parameter
    this.size = sz
    this.frm = frm
    if (geom) {
      this.params.intersects = geom
      // redo es queries including intersects
      this.queries = queries(this.params)
    }
    callback(err, resp)
  })
}


Search.prototype.search = function (index, callback) {
  var self = this

  var searchParams = {
    index: index,
    body: this.queries,
    size: this.size,
    from: this.frm,
    _source: this.fields  
  }

  console.log('Search parameters: ', JSON.stringify(searchParams))

  this.client.search(searchParams).then(function (body) {
    console.log(`body: ${JSON.stringify(body)}`)
    var count = body.hits.total;

    var response = {
      type: 'FeatureCollection',
      properties: {
        found: count,
        limit: self.size,
        page: self.page
      },
      features: []
    }

    // get all collections
    //var collections = body.hits.hits.map((c) => {
    //  return c[i]._source.collection
    //})

    for (var i = 0; i < body.hits.hits.length; i++) {
      var props = body.hits.hits[i]._source
      props = _.omit(props, ['bbox', 'geometry', 'assets', 'links', 'eo:bands'])
      var links = body.hits.hits[i]._source.links || []
      // add self and collection links
      let host = ('X-Forwarded-Host' in self.headers ? self.headers['X-Forwarded-Host'] : self.headers['Host'])
      let api_url = `${self.headers['X-Forwarded-Proto']}://${host}`
      let prefix = '/search/stac'
      if (index === 'collections') {
        prefix = '/collections'
        links['self'] = {'rel': 'self', 'href': `${api_url}${prefix}?c:id=${props['collection']}`}
      } else {
        links['self'] = {'rel': 'self', 'href': `${api_url}${prefix}?id=${props['id']}`}
        if (props.hasOwnProperty('c:id'))
          links['collection'] = {'href': `${api_url}/collections/${props['c:id']}/definition`}
      }
      response.features.push({
        type: 'Feature',
        properties: props,
        bbox: body.hits.hits[i]._source.bbox,
        geometry: body.hits.hits[i]._source.geometry,
        assets: body.hits.hits[i]._source.assets,
        links,
        'eo:bands': body.hits.hits[i]._source['eo:bands']
      })
    }

    return callback(null, response);
  }, function (err) {
    logger.error(err)
    return callback(err)
  });
}


module.exports = Search
