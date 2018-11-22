const test = require('ava')
const sinon = require('sinon')
const proxquire = require('proxyquire')
const api = require('../libs/api')

test('esSearch /stac', async (t) => {
  const collection = 'collection'
  const results = { results: [{ id: collection }] }
  const search = sinon.stub().resolves(results)
  const backend = { search }
  const actual = await api.esSearch('/stac', undefined, backend, 'endpoint')
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

test('esSearch es error', async (t) => {
  const error = sinon.spy()
  const proxyApi = proxquire('../libs/api', {
    './logger': {
      error
    }
  })
  const errorMessage = 'errorMessage'
  const search = sinon.stub().throws(new Error(errorMessage))
  const backend = { search }
  await proxyApi.esSearch('/stac', undefined, backend, 'endpoint')
  t.is(error.firstCall.args[0].message, errorMessage,
    'Logs Elasticsearch error via Winston transport')
})
