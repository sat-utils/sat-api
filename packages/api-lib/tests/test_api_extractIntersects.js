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

//test('extractIntersects', (t) => {
  //const valid = sinon.stub().returns(true)
  //const proxyApi = proxyquire('../libs/api', {
    //'geojson-validation': { valid }
  //})
  //let intersects = {
    //test: 'test',
    //type: 'Polgyon'
  //}
  //let actual = proxyApi.extractIntersects({ intersects })
  //t.deepEqual(actual.intersects.geometry, intersects,
    //'Returns new Feature GeoJSON object as the intersects property' +
    //' when a Geometry GeoJSON object is passed')
  //intersects = {
    //test: 'test',
    //type: 'Feature'
  //}
  //actual = proxyApi.extractIntersects({ intersects })
  //t.deepEqual(actual.intersects, intersects,
    //'Returns original as intersects property when a Feature' +
    //' GeoJSON object is passed')
//})
