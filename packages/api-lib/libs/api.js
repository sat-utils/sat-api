const gjv = require('geojson-validation')
const extent = require('@mapbox/extent')
const logger = require('./logger')


// max number of collections to retrieve
const COLLECTION_LIMIT = process.env.SATAPI_COLLECTION_LIMIT || 100


const errorResponse = function (message) {
  logger.error(message)
  return {
    code: 500,
    description: message
  }
}


const extractIntersects = function (params) {
  let intersectsGeometry
  const geojsonError = new Error('Invalid GeoJSON geometry')
  const geojsonFeatureError =
        new Error('Expected GeoJSON geometry, not Feature or FeatureCollection')
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
        throw geojsonFeatureError
      } else if (geojson.type === 'Feature') {
        throw geojsonFeatureError
      }
      intersectsGeometry = geojson
    } else {
      throw geojsonError
    }
  }
  return intersectsGeometry
}

const extractBbox = function (params) {
  let intersectsGeometry
  const { bbox } = params
  if (bbox) {
    let bboxArray
    if (typeof bbox === 'string') {
      bboxArray = JSON.parse(bbox)
    } else {
      bboxArray = bbox
    }
    const boundingBox = extent(bboxArray)
    intersectsGeometry = boundingBox.polygon()
  }
  return intersectsGeometry
}


const extractStacQuery = function (params) {
  let stacQuery
  const { query } = params
  if (query) {
    if (typeof query === 'string') {
      const parsed = JSON.parse(query)
      stacQuery = parsed
    } else {
      stacQuery = Object.assign({}, query)
    }
  }
  return stacQuery
}

const extractSort = function (params) {
  let sortRules
  const { sort } = params
  if (sort) {
    if (typeof sort === 'string') {
      sortRules = JSON.parse(sort)
    } else {
      sortRules = sort.slice()
    }
  }
  return sortRules
}

const extractFields = function (params) {
  let fieldRules
  const { fields } = params
  if (fields) {
    if (typeof fields === 'string') {
      fieldRules = JSON.parse(fields)
    } else {
      fieldRules = fields
    }
  }
  return fieldRules
}

const extractIds = function (params) {
  let idsRules
  const { ids } = params
  if (ids) {
    if (typeof ids === 'string') {
      idsRules = JSON.parse(ids)
    } else {
      idsRules = ids.slice()
    }
  }
  return idsRules
}


const extractCollectionIds = function (params) {
  let idsRules
  const { collections } = params
  if (collections) {
    if (typeof collections === 'string') {
      idsRules = JSON.parse(collections)
    } else {
      idsRules = collections.slice()
    }
  }
  return idsRules
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
    let { links } = result
    const { id, collection } = result

    links = (links === undefined) ? [] : links
    // self link
    links.splice(0, 0, {
      rel: 'self',
      href: `${endpoint}/collections/${collection}/items/${id}`
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
  const stac_version = process.env.STAC_VERSION
  const stac_id = process.env.STAC_ID
  const stac_title = process.env.STAC_TITLE
  const stac_description = process.env.STAC_DESCRIPTION
  const catalog = {
    stac_version,
    id: stac_id,
    title: stac_title,
    description: stac_description
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
  catalog.links.push({
    rel: 'search',
    href: `${endpoint}/stac/search`
  })
  catalog.links.push({
    rel: 'service',
    href: process.env.STAC_DOCS_URL
  })
  return catalog
}

const wrapResponseInFeatureCollection = function (
  meta, features = [], links = []
) {
  return {
    type: 'FeatureCollection',
    'search:metadata': meta,
    features,
    links
  }
}

const buildPageLinks = function (meta, parameters, endpoint) {
  const pageLinks = []

  const dictToURI = (dict) => (
    Object.keys(dict).map(
      (p) => `${encodeURIComponent(p)}=${encodeURIComponent(JSON.stringify(dict[p]))}`
    ).join('&')
  )
  const { matched, page, limit } = meta
  if ((page * limit) < matched) {
    const newParams = Object.assign({}, parameters, { page: page + 1, limit })
    const nextQueryParameters = dictToURI(newParams)
    pageLinks.push({
      rel: 'next',
      title: 'Next page of results',
      href: `${endpoint}/stac/search?${nextQueryParameters}`
    })
  }
  return pageLinks
}

const searchItems = async function (collectionId, queryParameters, backend, endpoint) {
  let response
  try {
    const {
      limit,
      next,
      datetime
    } = queryParameters
    const bbox = extractBbox(queryParameters)
    const hasIntersects = extractIntersects(queryParameters)
    if (bbox && hasIntersects) {
      throw new Error('Expected bbox OR intersects, not both')
    }
    const sort = extractSort(queryParameters)
    // Prefer intersects
    const intersects = hasIntersects || bbox
    const query = extractStacQuery(queryParameters)
    const fields = extractFields(queryParameters)
    const ids = extractIds(queryParameters)
    const collections = extractCollectionIds(queryParameters)

    const parameters = {
      datetime,
      intersects,
      query,
      sort,
      fields,
      ids,
      collections
    }

    // Keep only existing parameters
    const searchParameters = Object.keys(parameters)
      .filter((key) => parameters[key])
      .reduce((obj, key) => ({
        ...obj,
        [key]: parameters[key]
      }), {})

    if (collectionId) {
      searchParameters.collections = [collectionId]
    }
    const { results: itemsResults, 'search:metadata': itemsMeta } =
      await backend.search(searchParameters, 'items', next, limit)
    const pageLinks = buildPageLinks(itemsMeta, searchParameters, endpoint)
    const items = addItemLinks(itemsResults, endpoint)
    response = wrapResponseInFeatureCollection(itemsMeta, items, pageLinks)
  } catch (error) {
    logger.error(error)
    response = {
      code: 500,
      description: error.message
    }
  }
  return response
}


const getCatalog = async function (backend, endpoint = '') {
  try {
    const { results } = await backend.search({}, 'collections', 1, COLLECTION_LIMIT)
    return collectionsToCatalogLinks(results, endpoint)
  } catch (error) {
    return errorResponse(error.message)
  }
}


const getCollections = async function (backend, endpoint = '') {
  try {
    const { results, 'search:metadata': meta } =
    await backend.search({}, 'collections', 1, COLLECTION_LIMIT)
    const linkedCollections = addCollectionLinks(results, endpoint)
    return { 'search:metadata': meta, collections: linkedCollections }
  } catch (error) {
    return errorResponse(error.message)
  }
}


const getCollection = async function (collectionId, backend, endpoint = '') {
  try {
    const collectionQuery = { id: collectionId }
    const { results } = await backend.search(
      collectionQuery, 'collections', 1, 1
    )
    const col = addCollectionLinks(results, endpoint)
    if (col.length > 0) {
      return col[0]
    }
    return errorResponse('Collection not found')
  } catch (error) {
    return errorResponse(error.message)
  }
}


const getItem = async function (itemId, backend, endpoint = '') {
  try {
    const itemQuery = { id: itemId }
    const { results } = await backend.search(itemQuery, 'items')
    const [it] = addItemLinks(results, endpoint)
    if (it) {
      return it
    }
    return errorResponse('Item not found')
  } catch (error) {
    return errorResponse
  }
}


const API = async function (
  path = '', queryParameters = {}, backend, endpoint = ''
) {
  let apiResponse
  try {
    const pathElements = parsePath(path)

    const {
      stac,
      search: searchPath,
      collections,
      collectionId,
      items,
      itemId
    } = pathElements

    // Root catalog with collection links
    if (stac && !searchPath) {
      apiResponse = await getCatalog(backend, endpoint)
    }
    // STAC Search
    if (stac && searchPath) {
      apiResponse = await searchItems(
        null, queryParameters, backend, endpoint
      )
    }
    // All collections
    if (collections && !collectionId) {
      apiResponse = await getCollections(backend, endpoint)
    }
    // Specific collection
    if (collections && collectionId && !items) {
      apiResponse = await getCollection(collectionId, backend, endpoint)
    }
    // Items in a collection
    if (collections && collectionId && items && !itemId) {
      apiResponse = await searchItems(collectionId, queryParameters,
        backend, endpoint)
    }
    if (collections && collectionId && items && itemId) {
      apiResponse = await getItem(itemId, backend, endpoint)
    }
  } catch (error) {
    return errorResponse(error.message)
  }
  return apiResponse
}

module.exports = {
  getCatalog,
  getCollections,
  getCollection,
  getItem,
  searchItems,
  API,
  parsePath,
  extractIntersects
}
