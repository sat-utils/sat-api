const test = require('ava')
process.env.ES_HOST = 'http://192.168.99.100:4571'
const backend = require('../../libs/es')
const api = require('../../libs/api')

const { search } = api
const endpoint = 'endpoint'
test('ES integration test', async (t) => {
  const response = await search('/collections', {}, backend, endpoint)
  t.is(response.collections[0].id, 'landsat-8-l1')
  t.is(response.collections[1].id, 'collection2')
  t.is(response.meta.returned, 2)
})

