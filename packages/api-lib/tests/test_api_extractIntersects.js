const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const api = require('../libs/api')

test('extractIntersects', (t) => {
  const params = {}
  const intersectsGeometry = api.extractIntersects(params)
  t.falsy(intersectsGeometry,
    'Returns undefined when no intersects parameter')
})

test('extractIntersects', (t) => {
  const valid = sinon.stub().returns(false)
  const proxyApi = proxyquire('../libs/api', {
    'geojson-validation': { valid }
  })
  t.throws(() => {
    proxyApi.extractIntersects({ intersects: {} })
  }, null, 'Throws exception when GeoJSON is invalid')
})

test('extractIntersects', (t) => {
  const valid = sinon.stub().returns(true)
  const proxyApi = proxyquire('../libs/api', {
    'geojson-validation': { valid }
  })
  t.throws(() => {
    proxyApi.extractIntersects({
      intersects: { type: 'FeatureCollection' }
    })
  }, null, 'Throws exception when GeoJSON type is FeatureCollection')
})
