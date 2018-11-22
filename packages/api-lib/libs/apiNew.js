const gjv = require('geojson-validation')
const logger = require('./logger')
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

// Impure - mutates body
const addItemLinks = function (body, endpoint) {
  const { hits } = body
  const { hits: subHits } = hits

  const results = subHits.map((hit) => {
    const { _source: result } = hit
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

const buildMetaObject = function (body, page, limit) {
  const { hits } = body
  const { total: found, hits: subHits } = hits
  return {
    found,
    limit,
    page,
    returned: subHits.length
  }
}

const extractPageFromQuery = function (originalQuery) {
  const query = Object.assign({}, originalQuery)
  const page = parseInt(originalQuery.page) || 1
  const limit = parseInt(originalQuery.limit) || 1
  delete query.page
  delete query.limit
  return { query, page, limit }
}

const extractCollectionList = function (body) {
  const { hits } = body
  const { hits: subHits } = hits
  const results = subHits.map((result) => (result._source))
  const collections = results.map((result) => result.id).join()
  return collections
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

const buildPageLinks = function (body, page, limit, query, endpoint) {
  const pageLinks = []

  const dictToURI = (dict) => (
    Object.keys(dict).map(
      (p) => `${encodeURIComponent(p)}=${encodeURIComponent(dict[p])}`
    ).join('&')
  )

  const { hits } = body
  const { total: found } = hits
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
  const collectionBody = await backend.search(
    query, 'collections', page, limit
  )
  const collectionList = extractCollectionList(collectionBody)
  const collectionsQuery = Object.assign(
    {}, query, { collection: collectionList }
  )
  if (!collectionList.length) {
    const meta = buildMetaObject(collectionBody, page, limit)
    response = wrapResponseInFeatureCollection(meta)
  } else {
    const itemsBody = await backend.search(collectionsQuery, 'items', page, limit)
    const pageLinks = buildPageLinks(itemsBody, page, limit, query, endpoint)
    const items = addItemLinks(itemsBody, endpoint)
    const meta = buildMetaObject(itemsBody, page, limit)
    response = wrapResponseInFeatureCollection(meta, items, pageLinks)
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
    items
  } = parsePath(path)

  const { query, page, limit } = extractPageFromQuery(queryParameters)
  try {
    // Root catalog with collection links
    if (stac && !search) {
      const body = await backend.search(query, 'collections', page, limit)
      apiResponse = collectionsToCatalogLinks(body, endpoint)
    }
    if (stac && search) {
      apiResponse = await searchItems(query, page, limit, backend, endpoint)
    }
    // All collections
    if (collections && !collectionId) {
      const body = await backend.search(query, 'collections', page, limit)
      const collectionResults = addCollectionLinks(body, endpoint)
      const meta = buildMetaObject(body, page, limit)
      apiResponse = { meta, collectionResults }
    }
    // Specific collection
    if (collections && collectionId && !items) {
      // Do query params need merging here ?
      const collectionQuery = Object.assign({}, query, { 'id': collectionId })
      const body = await backend.search(
        collectionQuery, 'collections', page, limit
      )
      const collection = addCollectionLinks(body, endpoint)
      if (collection.length > 0) {
        apiResponse = collection[0]
      } else {
        apiResponse = new Error('Collection not found')
      }
    }
    if (collections && collectionId && items) {
      const itemsQuery = Object.assign(
        {}, query, { collection: collectionId }
      )
      apiResponse = await searchItems(itemsQuery, page, limit, backend, endpoint)
    }
  } catch (error) {
    logger.error(error)
  }
  return apiResponse
}

module.exports = {
  parsePath,
  esSearch,
  searchItems,
  parseIntersectsParam
}
