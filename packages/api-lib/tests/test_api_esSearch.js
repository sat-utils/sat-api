const test = require('ava')
const sinon = require('sinon')
const api = require('../libs/apiNew')

test('esSearch /stac', async (t) => {
  const collection = 'collection'
  const body = {
    hits: {
      hits: [{
        _source: { id: collection }
      }]
    }
  }
  const search = sinon.stub().resolves(body)
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
  t.deepEqual(actual.links, expectedLinks,
    'Returns STAC catalog with links to collections')
})
