var _ = require('lodash')

var kinks = require('turf-kinks')
var gjv = require('geojson-validation')

var geojsonError = new Error('Invalid Geojson')

/**
 * checks if the polygon is valid, e.g. does not have self intersecting
 * points
 * @param  {object} feature the geojson feature
 * @return {boolean}         returns true if the polygon is valid otherwise false
 */
var validatePolygon = function (feature) {
  var ipoints = kinks(feature);

  if (ipoints.features.length > 0) {
    throw new Error('Invalid Polgyon: self-intersecting')
  }
}

var termQuery = function (field, value) {
  var query = {
    match: {}
  }

  query.match[field] = {
    query: value,
    lenient: false,
    zero_terms_query: 'none'
  }

  query = {
    bool: {
      should: [
        query,
        {bool: {must_not: {exists: {'field': field}}}}
      ]}
  }

  return query
};

var rangeQuery = function (field, frm, to) {
  var query = {
    range: {}
  }

  query.range[field] = {
    gte: frm,
    lte: to
  }

  query = {
    bool: {
      should: [
        query,
        {bool: {must_not: {exists: {'field': field}}}}
      ]}
  }

  return query;
}

var geometryQuery = function (field, geometry) {
  var _geometry = Object.assign({}, geometry);

  var query = {
    geo_shape: {}
  }

  if (_geometry.type === 'Polygon') {
    _geometry.type = _geometry.type.toLowerCase();
  }

  query.geo_shape[field] = {
    shape: _geometry
  }

  return query;
}


var intersects = function (geojson, queries) {
  // if we receive an object, assume it's GeoJSON, if not, try and parse
  if (typeof geojson === 'string') {
    try {
      geojson = JSON.parse(geojson);
    } catch (e) {
      throw geojsonError;
    }
  }

  if (gjv.valid(geojson)) {
    if (geojson.type === 'FeatureCollection') {
      for (var i = 0; i < geojson.features.length; i++) {
        var feature = geojson.features[i];
        validatePolygon(feature);
        queries.push(geometryQuery('geometry', feature.geometry));
      }
    } else {
      if (geojson.type !== 'Feature') {
        geojson = {
          'type': 'Feature',
          'properties': {},
          'geometry': geojson
        };
      }
      validatePolygon(geojson);

      queries.push(geometryQuery('geometry', geojson.geometry));
    }
    return queries;
  } else {
    throw geojsonError;
  }
};

module.exports = function (params) {
  var response = {
    query: { match_all: {} }
    //sort: [
    //  {start: {order: 'desc'}}
    //]
  };
  var queries = [];

  params = _.omit(params, ['limit', 'page', 'skip']);

  // no filters, return everything
  if (Object.keys(params).length === 0) {
    return response;
  }

  // intersects search
  if (params.intersects) {
    queries = intersects(params.intersects, queries);
    params = _.omit(params, ['intersects']);
  }

  var interval, query
  _.forEach(params, function (value, key) {
    interval = value.split('/')
    if (interval.length > 1) {
      query = rangeQuery(key, interval[0], interval[1])
    } else {
      query = termQuery(key, value)
    }
    queries.push(query)
  })


  response.query = {
    bool: {
      must: queries
    }
  };

  return response;
};
