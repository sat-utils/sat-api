const test = require('ava')
const sinon = require('sinon')
const api = require('../libs/api')

test('search converts string query to object for search', async (t) => {
  const search = sinon.stub().resolves({ results: [], meta: {} })
  const backend = { search }
  const query = {
    'eo:cloud_cover': 50
  }
  const queryParameters = {
    query: JSON.stringify(query)
  }
  await api.search('stac/search/collections', queryParameters, backend, 'endpoint')
  t.deepEqual(search.firstCall.args[0], { query })
})
