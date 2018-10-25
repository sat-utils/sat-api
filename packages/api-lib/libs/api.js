'use strict'

const _ = require('lodash')
const geojsonError = new Error('Invalid GeoJSON Feature or geometry')
const gjv = require('geojson-validation')

const stac_version = '0.6.0-rc2'


// h/t https://medium.com/@mattccrampton/convert-a-javascript-dictionary-to-get-url-parameters-b77da8c78ec8
function dictToURI(dict) {
  return Object.keys(dict)
    .map((p) => `${encodeURIComponent(p)}=${encodeURIComponent(dict[p])}`).join('&')
}


// Elasticsearch search class
function API(backend, params, endpoint) {
  this.backend = backend
  this.params = params
  this.endpoint = endpoint
  this.clink = `${this.endpoint}/collections`

  // process GeoJSON if provided
  if (this.params.intersects) {
    let geojson = params.intersects
    // if we receive a string, try to parse as GeoJSON, otherwise assume it is GeoJSON
    if (typeof geojson === 'string') {
      try {
        geojson = JSON.parse(geojson)
      } catch (e) {
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
}


// Search collections
API.prototype.search_collections = function (callback) {
  // hacky way to remove geometry from search of collections...temporary
  let geom
  if (_.has(this.params, 'intersects')) {
    geom = this.params.intersects
    this.params = _.omit(this.params, 'intersects')
  }

  this.backend.search(this.params, 'collections', 1, 100, (err, resp) => {
    // set geometry back
    if (geom) {
      this.params.intersects = geom
    }

    resp.results.forEach((a, i, arr) => {
      // self link
      arr[i].links.splice(0, 0, { rel: 'self', href: `${this.clink}/${a.id}` })
      // parent catalog
      arr[i].links.push({ rel: 'parent', href: `${this.endpoint}/stac` })
      // root catalog
      arr[i].links.push({ rel: 'root', href: `${this.endpoint}/stac` })
      // child items
      arr[i].links.push({ rel: 'items', href: `${this.clink}/${a.id}/items` })
    })

    const response = {
      meta: resp.meta,
      collections: resp.results
    }

    callback(err, response)
  })
}


// Get a single collection by name
API.prototype.get_collection = function (collection, callback) {
  const params = this.params
  this.params = { 'id': collection }
  this.search_collections((err, resp) => {
    this.params = params
    if (resp.collections.length === 1) {
      callback(err, resp.collections[0])
    } else {
      callback(err, {})
    }
  })
}


// Search items (searching both collections and items)
API.prototype.search_items = function (page = 1, limit = 1, callback) {
  // check collection first
  this.search_collections((err, resp) => {
    const collections = resp.collections.map((c) => c.id)
    console.log('collections = ', JSON.stringify(collections))
    if (collections.length === 0) {
      const _resp = {
        type: 'FeatureCollection',
        meta: {
          found: 0, returned: 0, limit: limit, page: page
        },
        features: []
      }
      callback(null, _resp)
    } else {
      // shallow copy of this.params
      const params = { ...this.params }
      this.params.collection = collections.join(',')

      this.backend.search(this.params, 'items', page, limit, (e, response) => {
        const results = response.results.map((r) => {
          r.links.splice(0, 0, {
            rel: 'self',
            href: `${this.clink}/${r.properties.collection}/item/${r.id}`
          })
          // parent link
          r.links.push({
            rel: 'parent',
            href: `${this.clink}/${r.properties.collection}`
          })
          r.links.push({
            rel: 'collection',
            href: `${this.clink}/${r.properties.collection}`
          })
          r.links.push({ rel: 'root', href: `${this.endpoint}/stac` })
          r.type = 'Feature'
          return r
        })
        //})
        response.type = 'FeatureCollection'
        response.features = results
        // add next link if not last page
        if ((page * limit) < response.meta.found) {
          params.page = page + 1
          params.limit = limit
          response.links = [{
            rel: 'next',
            title: 'Next page of results',
            href: `${this.endpoint}/stac/search?${dictToURI(params)}`
          }]
        }
        callback(null, response)
      })
    }
  })
}


API.prototype.get_item = function (id, callback) {
  this.backend.search({ id }, 'items', 1, 1, (err, resp) => {
    if (resp.results.length === 1) {
      const item = resp.results[0]
      // self link
      item.links.splice(0, 0, {
        rel: 'self',
        href: `${this.clink}/${item.properties.collection}/item/${item.id}`
      })
      // parent link
      item.links.push({ rel: 'parent', href: `${this.clink}/${item.properties.collection}` })
      item.links.push({ rel: 'collection', href: `${this.clink}/${item.properties.collection}` })
      item.links.push({ rel: 'root', href: `${this.endpoint}/stac` })
      item.type = 'Feature'
      callback(err, item)
    } else {
      callback(err, {})
    }
  })
}


function STAC(path, endpoint, query, backend, respond = () => {}) {
  // default page and limit
  const _query = Object.assign({}, query)
  const page = parseInt(_query.page) || 1
  const limit = parseInt(_query.limit) || 1
  delete _query.page
  delete _query.limit

  console.log(`Query page=${page}, limit=${limit}`)

  // split and remove empty strings
  const resources = path.split('/').filter((x) => x)
  console.log('resources', resources)

  // a root catalog
  const cat = {
    id: 'sat-api',
    description: 'A STAC API of public datasets',
    'satapi:version': stac_version,
    stac_version: stac_version,
    links: [
      { rel: 'self', href: `${endpoint}/stac` }
    ]
  }

  const api = new API(backend, _query, endpoint)

  switch (resources[0]) {
  case 'stac':
    if (resources.length === 1) {
      api.search_collections((err, results) => {
        if (err) respond(err)
        results.collections.forEach((c) => {
          cat.links.push({ rel: 'child', href: `${endpoint}/collections/${c.id}` })
        })
        respond(null, cat)
      })
    } else if (resources[1] === 'search') {
      api.search_items(page, limit, respond)
    }
    break
  case 'collections':
    if (resources.length === 1) {
      // all collections
      api.search_collections(respond)
    } else if (resources.length === 2) {
      // specific collection
      api.get_collection(resources[1], respond)
    } else if (resources[2] === 'items') {
      console.log('search items in this collection')
      // this is a search across items in this collection
      api.params.collection = resources[1]
      api.search_items(page, limit, respond)
    } else if (resources[2] === 'item' && resources.length === 4) {
      // Get specific item in collection
      api.get_item(resources[3], respond)
    } else {
      const msg = 'endpoint not defined'
      console.log(msg, resources)
      respond(null, msg)
    }
    break
  default: {
    const msg = 'endpoint not defined'
    console.log(msg, resources)
    respond(null, msg)
  }
  }
}


module.exports.stac_version = stac_version
module.exports.STAC = STAC
