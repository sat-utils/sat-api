'use strict'

// Create an term query
const termQuery = (field, value, properties=true) => {
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
const rangeQuery = (field, frm, to, properties=true) => {
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


function build_query(params) {
  // no filters, return everything
  if (params.length === 0) {
    return {
      query: { match_all: {} }
    }
  }

  let queries = []

  // intersects search
  if (params.intersects) {
    queries.push({ 
      geo_shape: { [field]: { shape: params.intersects.geometry } } 
    })
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

  return {
    bool: { must: queries }
  }
}


module.exports = build_query