'use strict'

const _ = require('lodash')
const geojsonError = new Error('Invalid GeoJSON Feature or geometry')

const stac_version = '0.6.0'


function STAC(path, endpoint, query, backend, respond=()=>{}) {

  // default page and limit
  var page = parseInt(query.page) || 1
  var limit = parseInt(query.limit) || 1
  delete query.page
  delete query.limit

  console.log(`Query page=${page}, limit=${limit}`)

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
      id: 'sat-api',
      description: 'A STAC API of public datasets',
      'satapi:version': stac_version,
      stac_version: stac_version,
      links: [
        { rel: 'self', href: `${endpoint}/stac` }
      ]
    }
    const api = new API(backend, query, endpoint)
    api.search_collections((err, results) => {
      if (err) respond(err)
      for (let c of results.collections) {
        catalog.links.push({rel: 'child', href: `${endpoint}/stac/collections/${c.id}`})
      }
      respond(null, catalog)
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
        const api = new API(backend, query, endpoint)
        api.search_collections(respond)
      } else if (resources.length === 2) {
        // specific collection
        const api = new API(backend, query, endpoint)
        api.get_collection(resources[1], respond)
      } else if (resources[2] == 'items') {
        console.log('search items in this collection')
        // this is a search across items in this collection
        query['collection'] = resources[1]
        const api = new API(backend, query, endpoint)
        api.search_items(page, limit, respond)
      } else if (resources[2] == 'item' && resources.length == 4) {
        // Get specific item in collection
        const api = new API(backend, query, endpoint)
        api.get_item(resources[3], respond)
      } else {
        msg = 'endpoint not defined'
        console.log(msg, resources)
        respond(null, msg)
      }
      break;
    case 'search':
      // items api
      const api = new API(backend, query, endpoint)
      api.search_items(page, limit, respond)
      break
    default:
      respond(null, 'endpoint not defined')
    }
  }

}


// Elasticsearch search class
function API(backend, params, endpoint) {
  this.backend = backend
  this.params = params
  this.endpoint = endpoint
  this.clink = `${this.endpoint}/stac/collections`

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
      arr[i].links.splice(0, 0, {rel: 'self', href: `${this.clink}/${a.id}`})
      // parent catalog
      arr[i].links.push({rel: 'parent', href: `${this.endpoint}/stac`})
      // root catalog
      arr[i].links.push({rel: 'root', href: `${this.endpoint}/stac`})
      // child items
      arr[i].links.push({rel: 'items', href: `${this.clink}/${a.id}/items`})
    })

    resp.collections = resp.results
    delete resp.results

    callback(err, resp)
  })
}


// Get a single collection by name
API.prototype.get_collection = function (collection, callback) {
  let params = this.params
  this.params = {'id': collection}
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
API.prototype.search_items = function (page=1, limit=1, callback) {
  // check collection first
  this.search_collections((err, resp) => {
    const collections = resp.collections.map((c) => c.id)
    if (collections.length === 0) {
      let resp = {
        type: 'FeatureCollection',
        meta: { found: 0, returned: 0, limit: limit, page: page },
        features: []
      }
      callback(null, resp)
    } else {
      // shallow copy of this.params
      var params = { ...this.params }
      this.params['collection'] = collections.join(',')

      this.backend.search(this.params, 'items', page, limit, (err, resp) => {
        resp.results.forEach((a, i, arr) => {
          // self link
          arr[i].links.splice(0, 0, {
            rel: 'self',
            href: `${this.clink}/${a.properties.collection}/item/${a.id}`
          })
          // parent link
          arr[i].links.push({rel: 'parent', href: `${this.clink}/${a.properties.collection}`})
          arr[i].links.push({rel: 'collection', href: `${this.clink}/${a.properties.collection}`})
          arr[i].links.push({rel: 'root', href: `${this.endpoint}/stac`})
          arr[i]['type'] = 'Feature' 
        })
        resp.type = 'FeatureCollection',
        resp.features = resp.results
        delete resp.results
        // add next link if not last page
        if ((page * limit) < resp.meta.found) {
          params.page = page + 1
          params.limit = limit
          resp.links = [{
              rel: 'next', title: 'Next page of results', 
              href: `${this.endpoint}/stac/search?` + dictToURI(params)
          }]
        }
        callback(null, resp)
      })
    }
  })
}


API.prototype.get_item = function(id, callback) {
  this.backend.search({id}, 'items', 1, 1, (err, resp) => {
    if (resp.results.length === 1) {
        var item = resp.results[0]
        // self link
        item.links.splice(0, 0, {
          rel: 'self',
          href: `${this.clink}/${item.properties.collection}/item/${item.id}`
        })
        // parent link
        item.links.push({rel: 'parent', href: `${this.clink}/${item.properties.collection}`})
        item.links.push({rel: 'collection', href: `${this.clink}/${item.properties.collection}`})
        item.links.push({rel: 'root', href: `${this.endpoint}/stac`})
        item['type'] = 'Feature'
      callback(err, item)
    } else {
      callback(err, {})
    }
  })
}


// h/t https://medium.com/@mattccrampton/convert-a-javascript-dictionary-to-get-url-parameters-b77da8c78ec8
function dictToURI(dict) {
  var str = [];
  for(var p in dict){
     str.push(encodeURIComponent(p) + "=" + encodeURIComponent(dict[p]));
  }
  return str.join("&");
}


module.exports.stac_version = stac_version
module.exports.STAC = STAC