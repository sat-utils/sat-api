const gjv = require('geojson-validation')
const logger = require('./logger')
const page = 1
const limit = 10000
const stac_version = '0.6.0-rc2'
const sat_api = 'sat-api'

const parseIntersectsParam = function (params) {
  const geojsonError = new Error('Invalid GeoJSON Feature or geometry')
  const { intersects } = params
  let returnParams
  if (intersects) {
    let geojson
    // if we receive a string, try to parse as GeoJSON, otherwise assume it is GeoJSON
    if (typeof geojson === 'string') {
      try {
        geojson = JSON.parse(geojson)
      } catch (e) {
        throw geojsonError
      }
    } else {
      geojson = Object.assign({}, intersects)
      if (gjv.valid(geojson)) {
        if (geojson.type === 'FeatureCollection') {
          throw geojsonError
        } else if (geojson.type !== 'Feature') {
          geojson = {
            type: 'Feature',
            properties: {},
            geometry: Object.assign({}, intersects)
          }
        } else {
          throw geojsonError
        }
      }
    }
    returnParams = Object.assign({}, params, { intersects: geojson })
  } else {
    returnParams = params
  }
  return returnParams
}

const parsePath = function (path) {
  const searchFilters = {
    stac: false,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  const stac = 'stac'
  const collections = 'collections'
  const search = 'search'
  const items = 'items'

  const pathComponents = path.split('/').filter((x) => x)
  const { length } = pathComponents
  searchFilters.stac = pathComponents[0] === stac
  searchFilters.collections = pathComponents[0] === collections
  searchFilters.collectionId =
    pathComponents[0] === collections && length >= 2 ? pathComponents[1] : false
  searchFilters.search = pathComponents[1] === search
  searchFilters.items = pathComponents[2] === items
  searchFilters.itemId =
    pathComponents[2] === items && length === 4 ? pathComponents[3] : false
  return searchFilters
}

// Impure - mutates body
const addCollectionLinks = function (body, endpoint) {
  const { hits } = body
  const { hits: subHits } = hits
  const results = subHits.map((result) => (result._source))

  results.forEach((result) => {
    // self link
    result.links.splice(0, 0, {
      rel: 'self',
      href: `${endpoint}/collections/${result.id}`
    })
    // parent catalog
    result.links.push({
      rel: 'parent',
      href: `${endpoint}/stac`
    })
    // root catalog
    result.links.push({
      rel: 'root',
      href: `${endpoint}/stac`
    })
    // child items
    result.links.push({
      rel: 'items',
      href: `${endpoint}/collections/${result.id}/items`
    })
  })
  return results
}

const collectionsToCatalogLinks = function (body, endpoint) {
  const { hits } = body
  const { hits: subHits } = hits
  const results = subHits.map((result) => (result._source))

  const catalog = {
    stac_version,
    id: sat_api,
    description: 'A STAC API of public datasets',
    'satapi:version': stac_version
  }
  catalog.links = results.map((result) => ({
    rel: 'child',
    href: `${endpoint}/collections/${result.id}`
  }))
  catalog.links.push({
    rel: 'self',
    href: `${endpoint}/stac`
  })
  return catalog
}

const wrapResponseWithMeta = function (body) {
  const { hits } = body
  const { total: found, hits: subHits } = hits
  const results = subHits.map((result) => (result._source))
  const response = {
    results,
    meta: {
      found,
      limit,
      page,
      returned: results.length
    }
  }
  return response
}

const esSearch = async function (path = '', query = {}, backend, endpoint = '') {
  let apiResponse
  const {
    stac,
    search,
    collections,
    collectionId
  } = parsePath(path)

  try {
    if (stac && !search) {
      const body = await backend.search(query, 'collections', page, limit)
      apiResponse = collectionsToCatalogLinks(body, endpoint)
    } else if (collections && collectionId) {
      // Do query params need merging here ?
      const updatedQuery = Object.assign({}, query, { 'id': collectionId })
      const body = await backend.search(updatedQuery, 'collections', page, limit)
      const collection = addCollectionLinks(body, endpoint)
      if (collection.length > 0) {
        apiResponse = collection
      } else {
        apiResponse = new Error('Collection not found')
      }
    }
  } catch (error) {
    logger.error(error)
  }
  return apiResponse
}

module.exports = {
  parsePath,
  esSearch,
  parseIntersectsParam
}
