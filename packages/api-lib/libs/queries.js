'use strict'

const _ = require('lodash')

const kinks = require('turf-kinks')
const gjv = require('geojson-validation')

const geojsonError = new Error('Invalid Geojson')

/**
 * checks if the polygon is valid, e.g. does not have self intersecting
 * points
 *
 * @param  {Object} feature - the geojson feature
 * @returns {boolean}         returns true if the polygon is valid otherwise false
 */
const validatePolygon = (feature) => {
  const ipoints = kinks(feature)

  if (ipoints.features.length > 0) {
    throw new Error('Invalid Polgyon: self-intersecting')
  }
}

const termQuery = (field, value) => {
  let query = {
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
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }

  return query
}

const rangeQuery = (field, frm, to) => {
  let query = {
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
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }

  return query
}

const geometryQuery = (field, geometry) => {
  const _geometry = Object.assign({}, geometry)

  const query = {
    geo_shape: {}
  }

  if (_geometry.type === 'Polygon') {
    _geometry.type = _geometry.type.toLowerCase()
  }

  query.geo_shape[field] = {
    shape: _geometry
  }

  return query
}


const intersects = (inGeojson, queries) => {
  let geojson = inGeojson
  // if we receive an object, assume it's GeoJSON, if not, try and parse
  if (typeof geojson === 'string') {
    try {
      geojson = JSON.parse(inGeojson)
    }
    catch (e) {
      throw geojsonError
    }
  }

  if (gjv.valid(geojson)) {
    if (geojson.type === 'FeatureCollection') {
      for (let i = 0; i < geojson.features.length; i += 1) {
        const feature = geojson.features[i]
        validatePolygon(feature)
        queries.push(geometryQuery('geometry', feature.geometry))
      }
    }
    else {
      if (geojson.type !== 'Feature') {
        geojson = {
          type: 'Feature',
          properties: {},
          geometry: geojson
        }
      }
      validatePolygon(geojson)

      queries.push(geometryQuery('geometry', geojson.geometry))
    }
    return queries
  }
  throw geojsonError
}

module.exports = (inParams) => {
  const response = {
    query: { match_all: {} }
    //sort: [
    //  {start: {order: 'desc'}}
    //]
  }
  let queries = []

  let params = _.omit(inParams, ['limit', 'page', 'skip'])

  // no filters, return everything
  if (Object.keys(params).length === 0) {
    return response
  }

  // intersects search
  if (params.intersects) {
    queries = intersects(params.intersects, queries)
    params = _.omit(params, ['intersects'])
  }

  let interval
  let query

  _.forEach(params, (value, key) => {
    interval = value.split('/')
    if (interval.length > 1) {
      query = rangeQuery(key, interval[0], interval[1])
    }
    else {
      query = termQuery(key, value)
    }
    queries.push(query)
  })


  response.query = {
    bool: {
      must: queries
    }
  }

  return response
}
