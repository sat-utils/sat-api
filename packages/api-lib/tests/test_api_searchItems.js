const test = require('ava')
const sinon = require('sinon')
const api = require('../libs/api')
const item = require('./fixtures/item.json')
const itemLinks = require('./fixtures/itemLinks.json')

test('searchItems', async (t) => {
  const limit = 10
  const page = 1
  const meta = {
    limit,
    page,
    found: 0,
    returned: 0
  }
  const expected = {
    meta,
    features: [],
    links: [],
    type: 'FeatureCollection'
  }
  const results = { meta, results: [] }

  const search = sinon.stub().resolves(results)
  const backend = { search }
  const actual = await api.searchItems({}, page, limit, backend, 'endpoint')
  t.deepEqual(actual, expected,
    'Returns empty FeatureCollection when finds no matching collection')
})

test('searchItems', async (t) => {
  const collectionId = 'collectionId'
  const limit = 10
  const page = 1
  const meta = {
    limit,
    page,
    found: 1,
    returned: 1
  }
  const collectionResults = { meta, results: [{ id: collectionId }] }
  const itemsResults = { meta, results: [item] }
  const search = sinon.stub()
  search.onFirstCall().resolves(collectionResults)
  search.onSecondCall().resolves(itemsResults)
  const backend = { search }
  const actual = await api.searchItems({}, page, limit, backend, 'endpoint')
  t.is(search.secondCall.args[0].collection, collectionId,
    'Searches for items from found collections that meet the search criteria')
  t.deepEqual(actual.features[0].links, itemLinks.links,
    'Adds correct relative STAC links')
  const expectedMeta = {
    limit,
    page,
    found: 1,
    returned: 1
  }
  t.deepEqual(actual.meta, expectedMeta, 'Adds correct response metadata fields')
  t.is(actual.type, 'FeatureCollection', 'Wraps response as FeatureCollection')
})
