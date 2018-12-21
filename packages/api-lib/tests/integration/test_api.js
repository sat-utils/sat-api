const test = require('ava')
process.env.ES_HOST = 'http://192.168.99.100:4571'
const backend = require('../../libs/es')
const api = require('../../libs/api')

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
