const gjv = require('geojson-validation')
const extent = require('@mapbox/extent')
const { feature } = require('@turf/helpers')
const logger = require('./logger')
const stac_version = '0.6.0-rc2'
const sat_api = 'sat-api'

const extractIntersectsParam = function (params) {
  let returnParams
  const geojsonError = new Error('Invalid GeoJSON Feature or geometry')
  const { intersects } = params
  if (intersects) {
    let geojson
    // if we receive a string, try to parse as GeoJSON, otherwise assume it is GeoJSON
    if (typeof intersects === 'string') {
      try {
        geojson = JSON.parse(intersects)
      } catch (e) {
        throw geojsonError
      }
    } else {
      geojson = Object.assign({}, intersects)
    }

    if (gjv.valid(geojson)) {
      if (geojson.type === 'FeatureCollection') {
        throw geojsonError
      } else if (geojson.type !== 'Feature') {
        geojson = feature(geojson)
      }
      returnParams = Object.assign({}, params, { intersects: geojson })
    } else {
      throw geojsonError
    }
  } else {
    returnParams = params
  }
  return returnParams
}

const extractBboxParam = function (params) {
  let returnParams
  const { bbox } = params
  if (bbox) {
    const boundingBox = extent(bbox)
    const geojson = feature(boundingBox.polygon())
    returnParams = Object.assign({}, params, { intersects: geojson })
  } else {
    returnParams = params
  }
  return returnParams
}

const extractTimeParam = function (params) {
  let returnParams
  const { time } = params
  if (time) {
    returnParams = Object.assign({}, params, { datetime: time })
    delete returnParams.time
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

// Impure - mutates results
const addCollectionLinks = function (results, endpoint) {
  results.forEach((result) => {
    const { id, links } = result
    // self link
    links.splice(0, 0, {
      rel: 'self',
      href: `${endpoint}/collections/${id}`
    })
    // parent catalog
    links.push({
      rel: 'parent',
      href: `${endpoint}/stac`
    })
    // root catalog
    links.push({
      rel: 'root',
      href: `${endpoint}/stac`
    })
    // child items
    links.push({
      rel: 'items',
      href: `${endpoint}/collections/${id}/items`
    })
  })
  return results
}

// Impure - mutates results
const addItemLinks = function (results, endpoint) {
  results.forEach((result) => {
    const { id, links } = result
    const { collection } = result.properties
    // self link
    links.splice(0, 0, {
      rel: 'self',
      href: `${endpoint}/collections/${collection}/item/${id}`
    })
    // parent catalogs
    links.push({
      rel: 'parent',
      href: `${endpoint}/collections/${collection}`
    })
    links.push({
      rel: 'collection',
      href: `${endpoint}/collections/${collection}`
    })
    // root catalog
    links.push({
      rel: 'root',
      href: `${endpoint}/stac`
    })
    result.type = 'Feature'
    return result
  })
  return results
}

const collectionsToCatalogLinks = function (results, endpoint) {
  const catalog = {
    stac_version,
    id: sat_api,
    description: 'A STAC API of public datasets',
    'satapi:version': stac_version
  }
  catalog.links = results.map((result) => {
    const { id } = result
    return {
      rel: 'child',
      href: `${endpoint}/collections/${id}`
    }
  })
  catalog.links.push({
    rel: 'self',
    href: `${endpoint}/stac`
  })
  return catalog
}

const extractPageFromQuery = function (originalQuery) {
  const query = Object.assign({}, originalQuery)
  const page = parseInt(originalQuery.page) || 1
  const limit = parseInt(originalQuery.limit) || 1
  delete query.page
  delete query.limit
  return { query, page, limit }
}

const wrapResponseInFeatureCollection = function (
  meta, features = [], links = []
) {
  return {
    type: 'FeatureCollection',
    meta,
    features,
    links
  }
}

const buildPageLinks = function (meta, query, endpoint) {
  const pageLinks = []

  const dictToURI = (dict) => (
    Object.keys(dict).map(
      (p) => `${encodeURIComponent(p)}=${encodeURIComponent(dict[p])}`
    ).join('&')
  )
  const { found, page, limit } = meta
  if ((page * limit) < found) {
    const newParams = Object.assign({}, query, { page: page + 1, limit })
    const nextQueryParameters = dictToURI(newParams)
    pageLinks.push({
      rel: 'next',
      title: 'Next page of results',
      href: `${endpoint}/stac/search?${nextQueryParameters}`
    })
  }
  return pageLinks
}

const searchItems = async function (query, page, limit, backend, endpoint) {
  let response
  const { results: collectionResults, meta: collectionMeta } =
    await backend.search(query, 'collections', page, limit)
  const collectionList = collectionResults.map((result) => result.id).join()
  const collectionsQuery = Object.assign(
    {}, query, { collection: collectionList }
  )
  if (!collectionList.length) {
    response = wrapResponseInFeatureCollection(collectionMeta)
  } else {
    const { results: itemsResults, meta: itemsMeta } =
      await backend.search(collectionsQuery, 'items', page, limit)
    const pageLinks = buildPageLinks(itemsMeta, query, endpoint)
    const items = addItemLinks(itemsResults, endpoint)
    response = wrapResponseInFeatureCollection(itemsMeta, items, pageLinks)
  }
  return response
}

const esSearch = async function (
  path = '', queryParameters = {}, backend, endpoint = ''
) {
  let apiResponse
  const {
    stac,
    search,
    collections,
    collectionId,
    items,
    itemId
  } = parsePath(path)

  const timeParams = extractTimeParam(queryParameters)
  const bboxParams = extractBboxParam(timeParams)
  const intersectsParams = extractIntersectsParam(queryParameters)
  // Prefer intersects
  const params = intersectsParams.intersects ? intersectsParams : bboxParams
  const { query, page, limit } = extractPageFromQuery(params)
  try {
    // Root catalog with collection links
    if (stac && !search) {
      const { results } =
        await backend.search(undefined, 'collections', page, limit)
      apiResponse = collectionsToCatalogLinks(results, endpoint)
    }
    if (stac && search) {
      apiResponse = await searchItems(query, page, limit, backend, endpoint)
    }
    // All collections
    if (collections && !collectionId) {
      const { results, meta } =
        await backend.search(query, 'collections', page, limit)
      const linkedCollections = addCollectionLinks(results, endpoint)
      apiResponse = { meta, collections: linkedCollections }
    }
    // Specific collection
    if (collections && collectionId && !items) {
      // Do query params need merging here ?
      const collectionQuery = Object.assign({}, query, { 'id': collectionId })
      const { results } = await backend.search(
        collectionQuery, 'collections', page, limit
      )
      const collection = addCollectionLinks(results, endpoint)
      if (collection.length > 0) {
        apiResponse = collection[0]
      } else {
        apiResponse = new Error('Collection not found')
      }
    }
    if (collections && collectionId && items && !itemId) {
      const itemsQuery = Object.assign(
        {}, query, { collection: collectionId }
      )
      apiResponse = await searchItems(itemsQuery, page, limit, backend, endpoint)
    }
    if (collections && collectionId && items && itemId) {
      const itemQuery = Object.assign({}, query, { 'id': itemId })
      const { results } = await backend.search(itemQuery, 'items', page, limit)
      const [item] = addItemLinks(results, endpoint)
      if (item) {
        apiResponse = item
      } else {
        apiResponse = new Error('Item not found')
      }
    }
  } catch (error) {
    logger.error(error)
    apiResponse = error
  }
  return apiResponse
}

module.exports = {
  parsePath,
  searchItems,
  extractIntersectsParam,
  search: esSearch
}
