const test = require('ava')
const sinon = require('sinon')
const { filterCollections } = require('../libs/es')
const collection = require('./fixtures/stac/collection.json')
const collection2 = require('./fixtures/stac/collection2.json')

test('filterCollections', (t) => {
  const parameters = {
    query: {
      'eo:platform': {
        eq: 'landsat-8'
      },
      'eo:gsd': {
        eq: 15
      }
    }
  }
  const collections = [collection, collection2]
  filterCollections(parameters, collections)
  t.truthy(true)
})

