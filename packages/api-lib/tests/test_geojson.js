'use strict'

process.env.ES_HOST = 'localhost:9200'

const path = require('path')
const nock = require('nock')
const test = require('ava')
const gjv = require('geojson-validation')
const Search = require('../index').api
const payload = require('./events/geojson.json')

test.before('setup nock', () => {
  nock.back.fixtures = path.join(__dirname, '/fixtures')
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown')
})

test.cb.skip('geojson endpoint with simple GET should return 1 result', (t) => {
  const key = 'simpleGet'
  nock.back(`geojson-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.geojson((err, response) => {
      nockDone()
      t.is(response.properties.limit, 1)
      t.is(response.features.length, 1)
      t.true(gjv.valid(response))
      t.end(err)
    })
  })
})

test.cb.skip('geojson endpoint with simple POST should return 1 result', (t) => {
  const key = 'simplePost'
  nock.back(`geojson-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.geojson((err, response) => {
      nockDone()
      t.is(response.properties.limit, 1)
      t.is(response.features.length, 1)
      t.true(gjv.valid(response))
      t.end(err)
    })
  })
})

test.cb.skip('geojson endpoint with simple POST with limit 2 should return 2 result', (t) => {
  const key = 'simplePostLimit2'
  nock.back(`geojson-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.geojson((err, response) => {
      nockDone()
      t.is(response.properties.limit, 2)
      t.is(response.features.length, 2)
      t.true(gjv.valid(response))
      t.end(err)
    })
  })
})

test.cb.skip('geojson endpoint POST intersects', (t) => {
  const key = 'postIntersects'
  nock.back(`geojson-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.geojson((err, response) => {
      nockDone()
      t.is(response.properties.found, 237)
      t.is(response.properties.limit, 1)
      t.is(response.features.length, 1)
      t.true(gjv.valid(response))
      t.end(err)
    })
  })
})

test.cb.skip('geojson endpoint GET intersects with no match', (t) => {
  const key = 'getIntersects'
  nock.back(`geojson-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.geojson((err, response) => {
      nockDone()
      t.is(response.properties.found, 0)
      t.is(response.properties.limit, 1)
      t.is(response.features.length, 0)
      t.true(gjv.valid(response))
      t.end(err)
    })
  })
})

