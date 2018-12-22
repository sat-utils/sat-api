const test = require('ava')
process.env.ES_HOST = 'http://192.168.99.100:4571'
const backend = require('../../libs/es')
const api = require('../../libs/api')
const intersectsFeature = require('../fixtures/stac/intersectsFeature.json')
const noIntersectsFeature = require('../fixtures/stac/noIntersectsFeature.json')

const { search } = api
const endpoint = 'endpoint'

test('collections', async (t) => {
  const response = await search('/collections', {}, backend, endpoint)
  t.is(response.collections[0].id, 'landsat-8-l1')
  t.is(response.collections[1].id, 'collection2')
  t.is(response.meta.returned, 2)
})

test('collections/{collectionId}', async (t) => {
  let response = await search('/collections/landsat-8-l1', {}, backend, endpoint)
  t.is(response.id, 'landsat-8-l1')
  response = await search('/collections/collection2', {}, backend, endpoint)
  t.is(response.id, 'collection2')
})

test('collections/{collectionId}/items', async (t) => {
  const response = await search('/collections/landsat-8-l1/items',
    {}, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features[0].id, 'LC80100102015082LGN00')
  t.is(response.features[1].id, 'LC80100102015050LGN00')
})

test('collections/{collectionId}/items/{itemId}', async (t) => {
  const response =
    await search('/collections/landsat-8-l1/items/LC80100102015082LGN00',
      {}, backend, endpoint)
  t.is(response.type, 'Feature')
  t.is(response.id, 'LC80100102015082LGN00')
})

test('collections/{collectionId}/items with bbox', async (t) => {
  let response = await search('/collections/landsat-8-l1/items', {
    bbox: [-180, -90, 180, 90]
  }, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features[0].id, 'LC80100102015082LGN00')
  t.is(response.features[1].id, 'LC80100102015050LGN00')

  response = await search('/collections/landsat-8-l1/items', {
    bbox: [-5, -5, 5, 5]
  }, backend, endpoint)
  t.is(response.features.length, 0)
})

test('collections/{collectionId}/items with time', async (t) => {
  let response = await search('/collections/landsat-8-l1/items', {
    time: '2015-02-19T15:06:12.565047+00:00'
  }, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features[0].id, 'LC80100102015050LGN00')

  response = await search('/collections/landsat-8-l1/items', {
    time: '2015-02-17/2015-02-20'
  }, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features[0].id, 'LC80100102015050LGN00')
})

test('collections/{collectionId}/items with limit', async (t) => {
  const response = await search('/collections/landsat-8-l1/items', {
    limit: 1
  }, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features.length, 1)
})

test('collections/{collectionId}/items with intersects', async (t) => {
  let response = await search('/collections/landsat-8-l1/items', {
    intersects: intersectsFeature
  }, backend, endpoint)
  t.is(response.type, 'FeatureCollection')
  t.is(response.features[0].id, 'LC80100102015082LGN00')
  t.is(response.features[1].id, 'LC80100102015050LGN00')

  response = await search('/collections/landsat-8-l1/items', {
    intersects: noIntersectsFeature
  }, backend, endpoint)
  t.is(response.features.length, 0)
})

test('collections/{collectionId}/items with eq query', async (t) => {
  const response = await search('/collections/landsat-8-l1/items', {
    query: {
      'eo:cloud_cover': {
        eq: 0.54
      }
    }
  }, backend, endpoint)
  t.is(response.features.length, 1)
  t.is(response.features[0].id, 'LC80100102015050LGN00')
})

test('collections/{collectionId}/items with gt lt query', async (t) => {
  const response = await search('/collections/landsat-8-l1/items', {
    query: {
      'eo:cloud_cover': {
        gt: 0.5,
        lt: 0.6
      }
    }
  }, backend, endpoint)
  t.is(response.features.length, 1)
  t.is(response.features[0].id, 'LC80100102015050LGN00')
})


test('stac', async (t) => {
  const response = await search('/stac', {}, backend, endpoint)
  console.log(response)
  t.deepEqual(response.links[0], {
    rel: 'child',
    href: 'endpoint/collections/landsat-8-l1'
  })
  t.deepEqual(response.links[1], {
    rel: 'child',
    href: 'endpoint/collections/collection2'
  })
  t.deepEqual(response.links[2], {
    rel: 'self',
    href: 'endpoint/stac'
  })
})
