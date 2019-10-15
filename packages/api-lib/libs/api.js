const gjv = require('geojson-validation')
const extent = require('@mapbox/extent')
const { feature } = require('@turf/helpers')
const logger = require('./logger')

const extractIntersects = function (params) {
  let intersectsGeometry
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
    const geojson = feature(boundingBox.polygon())
    intersectsGeometry = geojson
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

const buildRootObject = function (endpoint) {
  const stac_docs_url = process.env.STAC_DOCS_URL
  const root = {
    links: [
      {
        href: endpoint,
        rel: 'self'
      },
      {
        href: `${endpoint}/collections`,
        rel: 'data'
      },
      {
        href: stac_docs_url,
        rel: 'service'
      }
    ]
  }
  return root
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
  return catalog
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

const buildPageLinks = function (meta, parameters, endpoint) {
  const pageLinks = []

  const dictToURI = (dict) => (
    Object.keys(dict).map(
      (p) => `${encodeURIComponent(p)}=${encodeURIComponent(JSON.stringify(dict[p]))}`
    ).join('&')
  )
  const { found, page, limit } = meta
  if ((page * limit) < found) {
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

const searchItems = async function (parameters, page, limit, backend, endpoint) {
  const { results: itemsResults, meta: itemsMeta } =
    await backend.search(parameters, 'items', page, limit)
  const pageLinks = buildPageLinks(itemsMeta, parameters, endpoint)
  const items = addItemLinks(itemsResults, endpoint)
  const response = wrapResponseInFeatureCollection(itemsMeta, items, pageLinks)
  return response
}

const search = async function (
  path = '', queryParameters = {}, backend, endpoint = ''
) {
  let apiResponse
  try {
    const pathElements = parsePath(path)
    const hasPathElement =
      Object.keys(pathElements).reduce((accumulator, key) => {
        let containsPathElement
        if (accumulator) {
          containsPathElement = true
        } else {
          containsPathElement = pathElements[key]
        }
        return containsPathElement
      }, false)

    const {
      stac,
      search: searchPath,
      collections,
      collectionId,
      items,
      itemId
    } = pathElements

    const {
      limit,
      page,
      time: datetime
    } = queryParameters
    const bbox = extractBbox(queryParameters)
    const hasIntersects = extractIntersects(queryParameters)
    const sort = extractSort(queryParameters)
    // Prefer intersects
    const intersects = hasIntersects || bbox
    const query = extractStacQuery(queryParameters)
    const fields = extractFields(queryParameters)
    const ids = extractIds(queryParameters)
    const parameters = {
      datetime,
      intersects,
      query,
      sort,
      fields,
      ids
    }
    // Keep only exisiting parameters
    const searchParameters = Object.keys(parameters)
      .filter((key) => parameters[key])
      .reduce((obj, key) => ({
        ...obj,
        [key]: parameters[key]
      }), {})
    // Landing page url
    if (!hasPathElement) {
      apiResponse = buildRootObject(endpoint)
    }
    // Root catalog with collection links
    if (stac && !searchPath) {
      const { results } =
        await backend.search({}, 'collections', page, limit)
      apiResponse = collectionsToCatalogLinks(results, endpoint)
    }
    // STAC Search
    if (stac && searchPath) {
      apiResponse = await searchItems(
        searchParameters, page, limit, backend, endpoint
      )
    }
    // All collections
    if (collections && !collectionId) {
      const { results, meta } =
        await backend.search({}, 'collections', page, limit)
      const linkedCollections = addCollectionLinks(results, endpoint)
      apiResponse = { meta, collections: linkedCollections }
    }
    // Specific collection
    if (collections && collectionId && !items) {
      const collectionQuery = { id: collectionId }
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
    // Items in a collection
    if (collections && collectionId && items && !itemId) {
      const updatedQuery = Object.assign({}, searchParameters.query, {
        collections: [
          collectionId
        ]
      })
      const itemIdParameters = Object.assign(
        {}, searchParameters, { query: updatedQuery }
      )
      apiResponse = await searchItems(
        itemIdParameters, page, limit, backend, endpoint
      )
    }
    if (collections && collectionId && items && itemId) {
      const itemQuery = { id: itemId }
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
    apiResponse = {
      code: 500,
      description: error.message
    }
  }
  return apiResponse
}

module.exports = {
  search,
  parsePath,
  searchItems,
  extractIntersects
}
