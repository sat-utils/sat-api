const test = require('ava')
const sinon = require('sinon')
const api = require('../libs/apiNew')
const item = require('./fixtures/item.json')
const itemLinks = require('./fixtures/itemLinks.json')

test('searchItems', async (t) => {
  const limit = 10
  const page = 1
  const hits = []
  const meta = {
    limit,
    page,
    found: hits.length,
    returned: hits.length
  }
  const expected = {
    meta,
    features: [],
    links: [],
    type: 'FeatureCollection'
  }
  const body = {
    hits: {
      hits,
      total: hits.length
    }
  }

  const search = sinon.stub().resolves(body)
  const backend = { search }
  const actual = await api.searchItems({}, page, limit, backend, 'endpoint')
  t.deepEqual(actual, expected,
    'Returns empty FeatureCollection when finds no matching collection')
})

test('searchItems', async (t) => {
  const collectionId = 'collectionId'
  const limit = 10
  const page = 1
  const collectionsHits = [{
    _source: {
      id: collectionId
    }
  }]
  const collectionsBody = {
    hits: {
      hits: collectionsHits
    }
  }
  const itemsHits = [{
    _source: item
  }]
  const itemsBody = {
    hits: {
      hits: itemsHits,
      total: itemsHits.length
    }
  }
  const search = sinon.stub()
  search.onFirstCall().resolves(collectionsBody)
  search.onSecondCall().resolves(itemsBody)
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
