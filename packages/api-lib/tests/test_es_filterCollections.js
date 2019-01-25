const test = require('ava')
const { filterCollections } = require('../libs/es')
const collection = require('./fixtures/stac/collection.json')
const collection2 = require('./fixtures/stac/collection2.json')

test('filterCollections handles multiple property filters', (t) => {
  const parameters = {
    query: {
      'eo:platform': {
        eq: 'landsat-8'
      },
      'eo:gsd': {
        eq: 15
      },
      'wat': {
        eq: 'nothing'
      }
    }
  }
  const collections = [collection, collection2]
  const filteredCollections = filterCollections(parameters, collections)
  t.deepEqual(filteredCollections[0], collection)
})

test('filterCollections handles gt filter', (t) => {
  let parameters = {
    query: {
      'eo:platform': {
        eq: 'landsat-8'
      },
      'eo:gsd': {
        gt: 13
      }
    }
  }
  const collections = [collection, collection2]
  let filteredCollections = filterCollections(parameters, collections)
  t.deepEqual(filteredCollections, collections)

  parameters = {
    query: {
      'eo:platform': {
        eq: 'landsat-8'
      },
      'eo:gsd': {
        gt: 14
      }
    }
  }
  filteredCollections = filterCollections(parameters, collections)
  t.deepEqual(filteredCollections[0], collection)
})

test('filterCollections handles gte filter', (t) => {
  let parameters = {
    query: {
      'eo:platform': {
        eq: 'landsat-8'
      },
      'eo:gsd': {
        gte: 14
      }
    }
  }
  const collections = [collection, collection2]
  let filteredCollections = filterCollections(parameters, collections)
  t.deepEqual(filteredCollections, collections)

  parameters = {
    query: {
      'eo:gsd': {
        gte: 15
      }
    }
  }
  filteredCollections = filterCollections(parameters, collections)
  t.deepEqual(filteredCollections[0], collection)
})

