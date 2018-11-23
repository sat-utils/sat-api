const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const api = require('../libs/api')

test('extractIntersectsParam', (t) => {
  const params = {}
  const intersectsParams = api.extractIntersectsParam(params)
  t.is(params, intersectsParams,
    'Passes through params object with no intersects property')
})

test('extractIntersectsParam', (t) => {
  const valid = sinon.stub().returns(false)
  const proxyApi = proxyquire('../libs/api', {
    'geojson-validation': { valid }
  })
  t.throws(() => {
    proxyApi.extractIntersectsParam({ intersects: {} })
  }, null, 'Throws exception when GeoJSON is invalid')
})

test('extractIntersectsParam', (t) => {
  const valid = sinon.stub().returns(true)
  const proxyApi = proxyquire('../libs/api', {
    'geojson-validation': { valid }
  })
  t.throws(() => {
    proxyApi.extractIntersectsParam({
      intersects: { type: 'FeatureCollection' }
    })
  }, null, 'Throws exception when GeoJSON type is FeatureCollection')
})

test('extractIntersectsParam', (t) => {
  const valid = sinon.stub().returns(true)
  const proxyApi = proxyquire('../libs/api', {
    'geojson-validation': { valid }
  })
  let intersects = {
    test: 'test',
    type: 'Polgyon'
  }
  let actual = proxyApi.extractIntersectsParam({ intersects })
  t.deepEqual(actual.intersects.geometry, intersects,
    'Returns new Feature GeoJSON object as the intersects property' +
    ' when a Geometry GeoJSON object is passed')
  intersects = {
    test: 'test',
    type: 'Feature'
  }
  actual = proxyApi.extractIntersectsParam({ intersects })
  t.deepEqual(actual.intersects, intersects,
    'Returns original as intersects property when a Feature' +
    ' GeoJSON object is passed')
})
