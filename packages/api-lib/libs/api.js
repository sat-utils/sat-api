'use strict'

const _ = require('lodash')
const logger = require('./logger')
const queries = require('./queries')
const es = require('./es')
//const esb = require('elastic-builder');
const geojsonError = new Error('Invalid GeoJSON Feature or geometry')


function STAC(path, endpoint, query, page=1, limit=100, respond=()=>{}) {

  // split and remove empty strings
  const resources = path.split('/').filter((x) => x)
  console.log('resources', resources)

  // make sure this is a STAC endpoint
  if (resources[0] !== 'stac') {
    let msg = 'endpoint not defined (use /stac)'
    console.log(msg, resources)
    respond(null, msg)
    return
  }

  let msg

  // /stac
  if (resources.length === 1) {
    msg = 'STAC catalog (see endpoints /search and /collections)'
    const catalog = {
      name: 'sat-api',
      description: 'A STAC API of public datasets',
      links: [
        { rel: 'self', href: `${endpoint}/stac` }
      ]
    }
    es.client().then((esClient) => {
      const api = new API(esClient, query, endpoint, page, limit=100)
      api.search_collections((err, results) => {
        if (err) respond(err)
        for (let c of results.collections) {
          catalog.links.push({rel: 'child', href: `${endpoint}/stac/collections/${c.name}`})
        }
        respond(null, catalog)
      })
    })
  } else {
    // drop the /stac prefix
    resources.splice(0, 1)
    // STAC endpoints
    switch (resources[0]) {
    case 'api':
      msg = 'TODO - return API doc'
      console.log(msg, resources)
      respond(null, msg)
      break
    // collections endpoint
    case 'collections':
      if (resources.length === 1) {
        // all collections
        es.client().then((esClient) => {
          const api = new API(esClient, query, endpoint, page, limit)
          api.search_collections(respond)
        })
      } else if (resources.length === 2) {
        // specific collection
        console.log('get_collection')
        es.client().then((esClient) => {
          const api = new API(esClient, query, endpoint, page, limit)
          api.get_collection(resources[1], (err, resp) => {
            respond(err, resp)
          })
        })
      } else if (resources[2] == 'items') {
        console.log('search items in this collection')
        // this is a search across items in this collection
        es.client().then((esClient) => {
          query['cid'] = resources[1]
          const api = new API(esClient, query, endpoint, page, limit)
          api.search_items(respond)
        })
      } else {
        msg = 'endpoint not defined'
        console.log(msg, resources)
        respond(null, msg)
      }
      break;
    case 'search':
      // items api
      es.client().then((esClient) => {
        const api = new API(esClient, query, endpoint, page, limit)
        api.search_items(respond)
      })
      break
    default:
      respond(null, 'endpoint not defined')
    }
  }

}


// Elasticsearch search class
function API(esClient, params, endpoint, page=1, limit=100) {
  this.client = esClient
  this.params = params
  this.endpoint = endpoint
  this.clink = `${this.endpoint}/stac/collections`
  this.page = parseInt(page)
  this.size = parseInt((limit) ? limit : 1)
  this.frm = (this.page - 1) * this.size

  // process GeoJSON if provided
  if (this.params.intersects) {
    let geojson = params.intersects
    // if we receive a string, try to parse as GeoJSON, otherwise assume it is GeoJSON
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
        throw geojsonError
      } else if (geojson.type !== 'Feature') {
          geojson = {
            type: 'Feature',
            properties: {},
            geometry: geojson
          }
      } else {
        throw geojsonError
      }
    }
    this.params.intersects = geojson
  }
  console.log('Search parameters:', this.params)
}


// general search of an index
API.prototype.search = function (index, callback) {
  const searchParams = {
    index: index,
    body: this.queries || queries(this.params),
    size: this.size,
    from: this.frm,
    _source: this.fields
  }

  console.log('Searching: ', JSON.stringify(searchParams))

  this.client.search(searchParams).then((body) => {
    const count = body.hits.total

    const response = {
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
  }

  this.search('collections', (err, resp) => {
    // set sz back to provided parameter
    this.size = sz
    this.frm = frm
    if (geom) {
      this.params.intersects = geom
    }

    resp.results.forEach((a, i, arr) => {
      // self link
      arr[i].links.splice(0, 0, {rel: 'self', href: `${this.clink}/${a.name}`})
      // parent catalog
      arr[i].links.push({rel: 'parent', href: `${this.endpoint}/stac`})
      // root catalog
      arr[i].links.push({rel: 'root', href: `${this.endpoint}/stac`})
      // child items
      arr[i].links.push({rel: 'child', href: `${this.clink}/${a.name}/items`})
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


module.exports = STAC