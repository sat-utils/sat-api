'use strict'

process.env.ES_HOST = 'localhost:9200'

const path = require('path')
const nock = require('nock')
const test = require('ava')
const Search = require('../index').api
const payload = require('./events/count.json')

test.before('setup nock', () => {
  nock.back.fixtures = path.join(__dirname, '/fixtures')
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown')
})

test.cb.skip('count endpoint with simple GET should return 1 result', (t) => {
  const key = 'simpleGet'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 987449)
      t.end(err)
    })
  })
})

test.cb.skip('count endpoint with simple POST should return 1 result', (t) => {
  const key = 'simplePost'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 987449)
      t.end(err)
    })
  })
})

test.cb.skip('count endpoint with simple POST should return 2 result', (t) => {
  const key = 'simplePostLimit2'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 987449)
      t.end(err)
    })
  })
})

test.cb.skip('count endpoint POST intersects', (t) => {
  const key = 'postIntersects'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 237)
      t.end(err)
    })
  })
})

test.cb.skip('count endpoint GET intersects with no match', (t) => {
  const key = 'getIntersects'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 0)
      t.end(err)
    })
  })
})

test.cb.skip('count endpoint GET with fields', (t) => {
  const key = 'getFields'
  nock.back(`count-${key}.json`, (nockDone) => {
    const search = new Search(payload[key])
    search.count((err, response) => {
      nockDone()
      t.is(response.meta.found, 987449)
      t.is(response.counts.terms_latitude_band.sum_other_doc_count, 69738)
      t.is(response.counts.terms_satellite_name.buckets[0].doc_count, 709937)
      t.end(err)
    })
  })
})

