'use strict'

const _ = require('lodash')
const logger = require('./logger')
const queries = require('./queries')
//const esb = require('elastic-builder');


// Elasticsearch search class
function API(esClient, params, endpoint, page=1, limit=100) {
  this.client = esClient
  this.params = params
  this.endpoint = endpoint
  this.clink = `${this.endpoint}/stac/collections`
  this.page = parseInt(page)
  this.size = parseInt((limit) ? limit : 1)
  this.frm = (this.page - 1) * this.size

  console.log('Search parameters:', this.params)

  this.queries = queries(this.params)
}


// general search of an index
API.prototype.search = function (index, callback) {
  const searchParams = {
    index: index,
    body: this.queries,
    size: this.size,
    from: this.frm,
    _source: this.fields
  }

  console.log('Searching: ', JSON.stringify(searchParams))

  this.client.search(searchParams).then((body) => {
    const count = body.hits.total

    const response = {
      //type: 'FeatureCollection',
      properties: {
        found: count,
        limit: this.size,
        page: this.page
      }
    }

    response.results = body.hits.hits.map((r) => (r._source))

    console.log(`Response: ${JSON.stringify(response)}`)

    return callback(null, response)
  }, (err) => {
    logger.error(err)
    return callback(err)
  })
}


// Search collections
API.prototype.search_collections = function (callback) {
  // hacky way to get all collections
  const sz = this.size
  const frm = this.frm
  // to ensure all collections get returned
  this.size = 100
  this.frm = 0
  // really hacky way to remove geometry from search of collections...temporary
  let geom
  if (_.has(this.params, 'intersects')) {
    geom = this.params.intersects
    this.params = _.omit(this.params, 'intersects')
    // redo es queries excluding intersects
    this.queries = queries(this.params)
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

    resp.results.forEach((a, i, arr) => {
      // self link
      arr[i].links.splice(0, 0, {rel: 'self', href: `${this.clink}/${a.name}`})
      arr[i].links.push({rel: 'parent', href: `${this.endpoint}/stac`})
      arr[i].links.push({rel: 'child', href: `${this.clink}/${a.name}/items`})
      arr[i].links.push({rel: 'root', href: `${this.endpoint}/stac`})
    })

    resp.collections = resp.results
    delete resp.results

    callback(err, resp)
  })
}


// Search items (searching both collections and items)
API.prototype.search_items = function (callback) {
  // check collection first
  this.search_collections((err, resp) => {
    const collections = resp.collections.map((c) => c.name)
    let qs
    if (collections.length === 0) {
      qs = { bool: { must_not: { exists: { field: 'cid' } } } }
    }
    else {
      qs = collections.map((c) => ({match: { name: { query: c } } }))
      qs = { bool: { should: qs } }
    }
    if (!_.has(this.queries.query, 'match_all')) {
      this.queries.query.nested.query.bool.must.push(qs)
    }
    console.log('queries after', JSON.stringify(this.queries))

    this.search('items', (err, resp) => {
      resp.results.forEach((a, i, arr) => {
        // self link
        arr[i].links.splice(0, 0, {rel: 'self', href: `${this.endpoint}/stac/search?id=${a.properties.id}`})
        // parent link
        if (_.has(a.properties, 'cid')) {
          arr[i].links.push({rel: 'parent', href: `${this.clink}/${a.properties.cid}`})
        }
        arr[i].links.push({rel: 'root', href: `${this.endpoint}/stac`})
        arr[i]['type'] = 'Feature' 
      })
      resp.type = 'FeatureCollection'
      resp.features = resp.results
      delete resp.results
    })
  })
}


// Get a single collection by name
API.prototype.get_collection = function (name, callback) {
  //const body = esb.requestBodySearch().query(
  //  esb.boolQuery().filter(esb.termQuery('name', name))
  //)
  //this.queries = body.toJSON()
  /*this.queries = {
    query: {
      bool: {
        filter: [
          {term: {name: name}}
        ]
      }
    }
  }*/
  this.queries = {
    query: {term: {name: name}}
  }
  this.search_collections((err, resp) => {
    if (resp.collections.length === 1) {
      callback(err, resp.collections[0])
    } else {
      callback(err, {})
    }
  })
}


module.exports = API