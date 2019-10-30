const test = require('ava')
const sinon = require('sinon')
const proxquire = require('proxyquire')
const api = require('../libs/api')
const item = require('./fixtures/item.json')
const itemLinks = require('./fixtures/itemLinks.json')

function cloneMutatedItem() {
  return Object.assign({}, item, { links: item.links.slice(0) })
}

test('search es error', async (t) => {
  const error = sinon.spy()
  const proxyApi = proxquire('../libs/api', {
    './logger': {
      error
    }
  })
  const errorMessage = 'errorMessage'
  const search = sinon.stub().throws(new Error(errorMessage))
  const backend = { search }
  const response = await proxyApi.API('/stac', undefined, backend, 'endpoint')
  t.is(error.firstCall.args[0].message, errorMessage,
    'Logs Elasticsearch error via Winston transport')
  t.is(response.message, errorMessage)
  t.is(response.code, 500)
})

test('search /', async (t) => {
  const actual = await api.API('/', undefined, undefined, 'endpoint')
  t.is(actual.links.length, 4)
})

test('search /api', async (t) => {
  const actual = await api.API('/api', undefined, undefined, 'endpoint')
  t.truthy(actual.openapi)
})

test('search /conformance', async (t) => {
  const actual = await api.API('/conformance', undefined, undefined, 'endpoint')
  t.truthy(actual.conformsTo)
  t.is(actual.conformsTo.length, 3)
})

test('search /stac', async (t) => {
  process.env.STAC_DOCS_URL = 'test'
  const collection = 'collection'
  const results = { results: [{ id: collection }] }
  const search = sinon.stub().resolves(results)
  const backend = { search }
  const actual = await api.API('/stac', undefined, backend, 'endpoint')
  const expectedLinks = [
    {
      rel: 'child',
      href: 'endpoint/collections/collection'
    },
    {
      rel: 'self',
      href: 'endpoint/stac'
    },
    {
      rel: 'search',
      href: 'endpoint/stac/search'
    },
    {
      href: 'test',
      rel: 'service'
    }
  ]
  t.is(search.firstCall.args[1], 'collections')
  t.deepEqual(actual.links, expectedLinks,
    'Returns STAC catalog with links to collections')
})

test('search /stac/search wraps results', async (t) => {
  const limit = 10
  const meta = {
    limit,
    next: null,
    matched: 1,
    returned: 1
  }
  const clonedItem = cloneMutatedItem()
  const results = [clonedItem]

  const itemsResults = { 'search:metadata': meta, results }
  const search = sinon.stub()
  search.resolves(itemsResults)
  const backend = { search }
  const actual = await api.API('/stac/search', {}, backend, 'endpoint')
  t.deepEqual(actual.features[0].links, itemLinks.links,
    'Adds correct relative STAC links')

  const expectedMeta = {
    limit,
    next: null,
    matched: 1,
    returned: 1
  }
  t.deepEqual(actual['search:metadata'], expectedMeta, 'Adds correct response metadata fields')
  t.is(actual.type, 'FeatureCollection', 'Wraps response as FeatureCollection')
})

test('search /stac/search query parameters', async (t) => {
  const search = sinon.stub().resolves({ results: [], meta: {} })
  const backend = { search }
  const query = { 'test': true }
  const queryParams = {
    page: 1,
    limit: 2,
    query
  }
  api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0], { query },
    'Extracts query to use in search parameters')
})

test('search /stac/search intersects parameter', async (t) => {
  const search = sinon.stub().resolves({ results: [], meta: {} })
  const backend = { search }
  const queryParams = {
    intersects: item.geometry,
    page: 1,
    limit: 1
  }
  api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, item.geometry,
    'Uses valid GeoJSON as intersects search parameter')

  search.resetHistory()
  queryParams.intersects = JSON.stringify(item.geometry)
  api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, item.geometry,
    'Handles stringified GeoJSON intersects parameter')
})

test('search /stac/search bbox parameter', async (t) => {
  const search = sinon.stub().resolves({ results: [], meta: {} })
  const backend = { search }
  const w = -10
  const s = -10
  const e = 10
  const n = 10
  const bbox = [w, s, e, n]
  const queryParams = {
    bbox,
    page: 1,
    limit: 1
  }
  const expected = {
    type: 'Polygon',
    coordinates: [[
      [s, w],
      [n, w],
      [n, e],
      [s, e],
      [s, w]
    ]]
  }
  await api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, expected,
    'Converts a [w,s,e,n] bbox to an intersects search parameter')
  search.resetHistory()
  queryParams.bbox = `[${bbox.toString()}]`
  await api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, expected,
    'Converts stringified [w,s,e,n] bbox to an intersects search parameter')
})

test('search /stac/search time parameter', async (t) => {
  const search = sinon.stub().resolves({ results: [], meta: {} })
  const backend = { search }
  const range = '2007-03-01T13:00:00Z/2008-05-11T15:30:00Z'
  const queryParams = {
    page: 1,
    limit: 2,
    datetime: range
  }
  await api.API('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0], { datetime: range },
    'Extracts time query parameter and transforms it into ' +
    'datetime search parameter')
})

test('search /collections', async (t) => {
  const meta = {
    limit: 1,
    page: 1,
    found: 1,
    returned: 1
  }
  const search = sinon.stub().resolves({
    meta,
    results: [{
      id: 1,
      links: []
    }]
  })
  const backend = { search }
  const actual = await api.API('/collections', {}, backend, 'endpoint')
  t.is(search.firstCall.args[1], 'collections')
  t.is(actual.collections.length, 1)
  t.is(actual.collections[0].links.length, 4, 'Adds STAC links to each collection')
})

test('search /collections/collectionId', async (t) => {
  const meta = {
    limit: 1,
    page: 1,
    found: 1,
    returned: 1
  }
  const search = sinon.stub().resolves({
    meta,
    results: [{
      id: 1,
      links: []
    }]
  })
  const backend = { search }
  const collectionId = 'collectionId'
  let actual = await api.API(
    `/collections/${collectionId}`, { test: 'test' }, backend, 'endpoint'
  )
  t.deepEqual(search.firstCall.args[0], { id: collectionId },
    'Calls search with the collectionId path element as id parameter' +
    ' and ignores other passed filter parameters')
  t.is(actual.links.length, 4, 'Returns the first found collection as object')

  search.reset()
  search.resolves({
    meta,
    results: []
  })
  actual = await api.API(
    `/collections/${collectionId}`, {}, backend, 'endpoint'
  )
  t.is(actual.message, 'Collection not found',
    'Sends error when not collections are found in search')
})

test('search /collections/collectionId/items', async (t) => {
  const meta = {
    limit: 1,
    page: 1,
    found: 1,
    returned: 1
  }

  const search = sinon.stub().resolves({
    meta,
    results: []
  })
  const backend = { search }
  const collectionId = 'collectionId'
  await api.API(
    `/collections/${collectionId}/items`, {}, backend, 'endpoint'
  )
  const expectedParameters = {
    collections: [collectionId]
  }
  t.deepEqual(search.firstCall.args[0], expectedParameters,
    'Calls search with the collectionId as a parameter')
})

test('search /collections/collectionId/items/itemId', async (t) => {
  const meta = {
    limit: 1,
    page: 1,
    found: 1,
    returned: 1
  }
  const clonedItem = cloneMutatedItem()
  const results = [clonedItem]
  const search = sinon.stub().resolves({
    meta,
    results
  })
  const backend = { search }
  const itemId = 'itemId'
  const actual = await api.API(
    `/collections/collectionId/items/${itemId}`, {}, backend, 'endpoint'
  )
  t.deepEqual(search.firstCall.args[0], { id: itemId },
    'Calls search with the itemId path element as id parameter' +
    ' and ignores other passed filter parameters')

  t.is(actual.type, 'Feature')
  t.is(actual.links.length, 4, 'Adds STAC links to response object')
})
