const test = require('ava')
const api = require('../libs/api')

test('parsePath', (t) => {
  let expected = {
    root: true,
    api: false,
    conformance: false,
    stac: false,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  let actual = api.parsePath('/')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: true,
    conformance: false,
    stac: false,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  actual = api.parsePath('/api')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: true,
    stac: false,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  actual = api.parsePath('/conformance')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: true,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  actual = api.parsePath('/stac')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: true,
    collections: false,
    search: true,
    collectionId: false,
    items: false,
    itemId: false
  }
  actual = api.parsePath('/stac/search')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: false,
    collections: true,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  actual = api.parsePath('/collections')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: false,
    collections: true,
    search: false,
    collectionId: 'id',
    items: false,
    itemId: false
  }
  actual = api.parsePath('/collections/id')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: false,
    collections: true,
    search: false,
    collectionId: 'id',
    items: true,
    itemId: false
  }
  actual = api.parsePath('/collections/id/items')
  t.deepEqual(actual, expected)

  expected = {
    root: false,
    api: false,
    conformance: false,
    stac: false,
    collections: true,
    search: false,
    collectionId: 'id',
    items: true,
    itemId: 'id'
  }
  actual = api.parsePath('/collections/id/items/id')
  t.deepEqual(actual, expected)
})

