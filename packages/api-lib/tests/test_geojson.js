'use strict';
process.env.ES_HOST = 'localhost:9200';

var path = require('path');
var nock = require('nock');
var test = require('ava');
var gjv = require('geojson-validation');
var Search = require('../index').api;
var payload = require('./events/geojson.json');

test.before('setup nock', function (t) {
  nock.back.fixtures = path.join(__dirname, '/fixtures');
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown');
});

test.cb.skip('geojson endpoint with simple GET should return 1 result', function (t) {
  var key = 'simpleGet';
  nock.back('geojson-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.geojson(function (err, response) {
      nockDone();
      t.is(response.properties.limit, 1);
      t.is(response.features.length, 1);
      t.true(gjv.valid(response));
      t.end(err);
    });
  });
});

test.cb.skip('geojson endpoint with simple POST should return 1 result', function (t) {
  var key = 'simplePost';
  nock.back('geojson-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.geojson(function (err, response) {
      nockDone();
      t.is(response.properties.limit, 1);
      t.is(response.features.length, 1);
      t.true(gjv.valid(response));
      t.end(err);
    });
  });
});

test.cb.skip('geojson endpoint with simple POST with limit 2 should return 2 result', function (t) {
  var key = 'simplePostLimit2';
  nock.back('geojson-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.geojson(function (err, response) {
      nockDone();
      t.is(response.properties.limit, 2);
      t.is(response.features.length, 2);
      t.true(gjv.valid(response));
      t.end(err);
    });
  });
});

test.cb.skip('geojson endpoint POST intersects', function (t) {
  var key = 'postIntersects';
  nock.back('geojson-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.geojson(function (err, response) {
      nockDone();
      t.is(response.properties.found, 237);
      t.is(response.properties.limit, 1);
      t.is(response.features.length, 1);
      t.true(gjv.valid(response));
      t.end(err);
    });
  });
});

test.cb.skip('geojson endpoint GET intersects with no match', function (t) {
  var key = 'getIntersects';
  nock.back('geojson-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.geojson(function (err, response) {
      nockDone();
      t.is(response.properties.found, 0);
      t.is(response.properties.limit, 1);
      t.is(response.features.length, 0);
      t.true(gjv.valid(response));
      t.end(err);
    });
  });
});

