const test = require('ava')
const sinon = require('sinon')
const proxquire = require('proxyquire')
const api = require('../libs/api')

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
  await proxyApi.search('/stac', undefined, backend, 'endpoint')
  t.is(error.firstCall.args[0].message, errorMessage,
    'Logs Elasticsearch error via Winston transport')
})

test('esSearch /stac', async (t) => {
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

test('esSearch /stac', async (t) => {
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
