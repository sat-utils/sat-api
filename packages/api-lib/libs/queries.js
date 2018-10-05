'use strict'

// Create an term query
const termQuery = (field, value, properties=True) => {
  // the default is to search the properties of a record
  if (properties) {
    field = 'properties.' + field
  }
  let query = {
    bool: {
      should: [
        { term: { [field]: value } },
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }
  if (properties) {
    query = { nested: { path: 'properties', query: query } }
  }
  return query
}


// Create a range query
const rangeQuery = (field, frm, to, properties=True) => {
  if (properties) {
    field = 'properties.' + field
  }
  let query = {
    bool: {
      should: [
        { range: { [field]: { gte: frm, lte: to } } },
        { bool: { must_not: { exists: { field: field } } } }
      ]
    } 
  }
  if (properties) {
    query = { nested: { path: 'properties', query: query } }
  }
  return query
}


// Create a geometry query
const geometryQuery = (field, geometry) => {
  const _geometry = Object.assign({}, geometry)
  // TODO - support other geometry types
  if (_geometry.type === 'Polygon') {
    _geometry.type = _geometry.type.toLowerCase()
  }
  let query = {
    geo_shape: { [field]: { shape: _geometry } }
  }
  return query
}


module.exports = (params) => {
  let response = {
    query: { match_all: {} }
  }
  // no filters, return everything
  if (params.length === 0) {
    return response
  }

  let queries = []

  // intersects search
  if (params.intersects) {
    queries.push(geometryQuery('geometry', params.intersects.geometry))
    delete params.intersects
  }

  // create range and term queries
  let range
  for (var key in params) {
    range = params[key].split('/')
    if (range.length > 1) {
      queries.push(rangeQuery(key, range[0], range[1]))
    } else {
      queries.push(termQuery(key, params[key]))
    }
  }

  response.query = {
    bool: { must: queries }
  }

  return response
}
