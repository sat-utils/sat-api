'use strict'


const termQuery = (field, value) => {
  let query = {
    term: {field: value}
  }

  return {
    bool: {
      should: [
        query,
        // match if field is not present at all
        { bool: { must_not: { exists: { field: field } } } }
      ]
    }
  }

  //return { bool: query }
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

  // TODO - support other geometry types
  if (_geometry.type === 'Polygon') {
    _geometry.type = _geometry.type.toLowerCase()
  }

  query.geo_shape[field] = {
    shape: _geometry
  }

  return query
}


module.exports = (params) => {
  const response = {
    query: { match_all: {} }
    //sort: [
    //  {start: {order: 'desc'}}
    //]
  }
  let queries = []

  // no filters, return everything
  if (params.length === 0) {
    return response
  }

  // intersects search
  if (params.intersects) {
    queries.push(geometryQuery('geometry', params.intersects.geometry))
    delete params.intersects
  }

  let range
  let query

  for (var key in params) {
    range = params[key].split('/')
    if (range.length > 1) {
      query = rangeQuery(key, range[0], range[1])
    }
    else {
      query = termQuery(key, params[key])
    }
    queries.push(query)
  })


  response.query = {
    nested: {
      path: 'properties',
      query: {
        bool: {
          must: queries
        }
      }
    }
  }

  response.query = {
    bool: {
      must: queries
    }
  }

  return response
}
