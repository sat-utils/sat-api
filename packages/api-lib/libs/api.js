'use strict'

const _ = require('lodash')
const logger = require('./logger')
const queries = require('./queries')

// Search class
function Search(event, esClient) {
  let params = {}

  if (_.has(event, 'query') && !_.isEmpty(event.query)) {
    params = event.query
  }
  else if (_.has(event, 'body') && !_.isEmpty(event.body)) {
    params = event.body
  }

  this.endpoint = event.endpoint

  this.merge = false
  if (_.has(params, 'merge')) {
    this.merge = params.merge
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
}

// search for items using collection and items
Search.prototype.search_items = function (callback) {
  // check collection first
  this.search_collections((err, resp) => {
    const collections = resp.collections.map((c) => c.properties['cid'])
    let qs
    if (collections.length === 0) {
      qs = { bool: { must_not: { exists: { field: 'cid' } } } }
    }
    else {
      qs = collections.map((c) => ({ match: { 'name': { query: c } } }))
      qs = { bool: { should: qs } }
    }
    if (!_.has(this.queries.query, 'match_all')) {
      this.queries.query.bool.must.push(qs)
    }
    console.log('queries after', JSON.stringify(this.queries))
    return this.search('items', callback)
  })
}


Search.prototype.search_collections = function (callback) {
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
  const self = this

  const searchParams = {
    index: index,
    body: this.queries,
    size: this.size,
    from: this.frm,
    _source: this.fields
  }

  console.log('Search parameters: ', JSON.stringify(searchParams))

  this.client.search(searchParams).then((body) => {
    console.log(`body: ${JSON.stringify(body)}`)
    const count = body.hits.total

    const response = {
      //type: 'FeatureCollection',
      results: {
        found: count,
        limit: self.size,
        page: self.page
      }
    }

    const features = _.range(body.hits.hits.length).map((i) => {
      let source = body.hits.hits[i]._source
      let props = body.hits.hits[i]._source.properties
      //props = _.omit(props, ['bbox', 'geometry', 'assets', 'links'])
      const links = body.hits.hits[i]._source.links || []

      // link to collection
      var collink = (_.has(source.properties, 'cid')) ? 
        `${self.endpoint}/stac/collections/${source.properties['cid']}/definition` : null

      if (index === 'collections') {
        // self link
        links.splice(0, 0, {rel: 'self', href: collink})
        // parent link
        links.push({rel: 'parent', href: `${self.endpoint}/stac`})
        links.push({rel: 'child', href: collink.replace('definition', 'items')})
      } else {
        // Item
        response
        // self link
        links.splice(0, 0, {rel: 'self', href: `${self.endpoint}/stac/search?id=${source.properties.id}`})
        // parent link
        if (collink) links.push({rel: 'parent', href: collink})
        source['type'] = 'Feature'
      }
      links.push({rel: 'root', href: `${self.endpoint}/stac`})

      source.links = links
      return source
    })

    if (index === 'collections') {
      // collections
      response.collections = features
    } else {
      // item
      response.type = 'FeatureCollection'
      response.features = features
    }

    return callback(null, response)
  }, (err) => {
    logger.error(err)
    return callback(err)
  })
}


module.exports = Search
