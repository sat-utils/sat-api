const test = require('ava')
const sinon = require('sinon')
const proxquire = require('proxyquire')
const api = require('../libs/api')
const item = require('./fixtures/item.json')

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
  await proxyApi.search('/stac', undefined, backend, 'endpoint')
  t.is(error.firstCall.args[0].message, errorMessage,
    'Logs Elasticsearch error via Winston transport')
})

test('search /stac', async (t) => {
  const collection = 'collection'
  const results = { results: [{ id: collection }] }
  const search = sinon.stub().resolves(results)
  const backend = { search }
  const actual = await api.search('/stac', undefined, backend, 'endpoint')
  const expectedLinks = [
    {
      rel: 'child',
      href: 'endpoint/collections/collection'
    },
    {
      rel: 'self',
      href: 'endpoint/stac'
    }
  ]
  t.is(search.firstCall.args[1], 'collections')
  t.deepEqual(actual.links, expectedLinks,
    'Returns STAC catalog with links to collections')
})

test('search /stac/search query parameters', async (t) => {
  const search = sinon.stub().resolves({ results: [] })
  const backend = { search }
  const queryParams = {
    page: 1,
    limit: 2,
    test: 'test'
  }
  api.search('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0], { test: 'test' },
    'Extracts limit and page from query parameters before Elasticsearch search')
  t.is(search.firstCall.args[2], queryParams.page,
    'Sends extracted page query parameter to Elasticsearch')
  t.is(search.firstCall.args[3], queryParams.limit,
    'Sends extracted limit query parameter to Elasticsearch')
})

test('search /stac/search intersects parameter', async (t) => {
  const search = sinon.stub().resolves({ results: [] })
  const backend = { search }
  const queryParams = {
    intersects: item,
    page: 1,
    limit: 1
  }
  api.search('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, item,
    'Uses valid GeoJSON as Elasticsearch intersects search parameter')

  search.resetHistory()
  queryParams.intersects = JSON.stringify(item)
  api.search('/stac/search', queryParams, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0].intersects, item,
    'Handles stringified GeoJSON intersects parameter')
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
  const actual = await api.search('/collections', {}, backend, 'endpoint')
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
  let actual = await api.search(
    `/collections/${collectionId}`, {}, backend, 'endpoint'
  )
  t.deepEqual(search.firstCall.args[0], { id: collectionId },
    'Calls Elasticsearch with the collectionId path element as id parameter')
  t.is(actual.links.length, 4, 'Returns the first found collection as object')

  search.reset()
  search.resolves({
    meta,
    results: []
  })
  actual = await api.search(
    `/collections/${collectionId}`, {}, backend, 'endpoint'
  )
  t.is(actual.message, 'Collection not found',
    'Sends error when not collections are found in Elasticsearch')
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
  await api.search(
    `/collections/${collectionId}/items`, {}, backend, 'endpoint'
  )
  t.deepEqual(search.firstCall.args[0], { collection: collectionId },
    'Calls Elasticsearch with the collectionId path element as collection parameter')
})

test('search /collections/collectionId/items/itemId', async (t) => {
  const meta = {
    limit: 1,
    page: 1,
    found: 1,
    returned: 1
  }

  const search = sinon.stub().resolves({
    meta,
    results: [item]
  })
  const backend = { search }
  const itemId = 'itemId'
  const actual = await api.search(
    `/collections/collectionId/items/${itemId}`, {}, backend, 'endpoint'
  )
  t.deepEqual(search.firstCall.args[0], { id: itemId },
    'Calls Elasticsearch with the itemId path element as id parameter')
  t.is(actual.type, 'Feature')
  t.is(actual.links.length, 4, 'Adds STAC links to response object')
})
