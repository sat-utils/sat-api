'use strict';
process.env.ES_HOST = 'localhost:9200';

var _ = require('lodash');
var path = require('path');
var nock = require('nock');
var test = require('ava');
var Search = require('../index').api;
var payload = require('./events/simple.json');

test.before('setup nock', function (t) {
  nock.back.fixtures = path.join(__dirname, '/fixtures');
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown');
});

test.cb.skip('test with invalid polygon', function (t) {
  var key = 'simpleGet';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload.getSelfIntersectingPolygon);
    search.simple(function (err, response) {
      nockDone();
      t.is(err.message, 'Invalid Polgyon: self-intersecting');
      t.end();
    });
  });
});

test.cb.skip('root endpoint with simple GET should return 1 result', function (t) {
  var key = 'simpleGet';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.true(_.has(response.results[0], 'scene_id'));
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with simple POST should return 1 result', function (t) {
  var key = 'simplePost';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.true(_.has(response.results[0], 'scene_id'));
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with simple post limit 2 and fields', function (t) {
  var key = 'simplePostLimit2WithFields';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.limit, 2);
      t.is(response.results.length, 2);
      t.false(_.has(response.results[0], 'scene_id'));
      t.true(_.has(response.results[0], 'date'));
      t.true(_.has(response.results[0], 'thumbnail'));
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with simple POST with limit 2 should return 2 resul', function (t) {
  var key = 'simplePostLimit2';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.limit, 2);
      t.is(response.results.length, 2);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with POST date range', function (t) {
  var key = 'postDatRange';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 454226);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 0', function (t) {
  var key = 'postIntersects_coverage_zero';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 237);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 50', function (t) {
  var key = 'postIntersects_coverage_50';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 8);
      t.is(response.meta.limit, 10);
      t.is(response.results.length, 8);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 100', function (t) {
  var key = 'postIntersects_coverage_100';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 3);
      t.is(response.meta.limit, 10);
      t.is(response.results.length, 3);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET intersects with no match', function (t) {
  var key = 'getIntersects';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 0);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 0);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET invalid intersect', function (t) {
  var key = 'getIntersectsInvalid';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(err.message, 'Invalid Geojson');
      t.end();
    });
  });
});

test.cb.skip('root endpoint GET string intersects', function (t) {
  var key = 'getIntersectsString';

  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 0);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 0);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET string intersects with satelline_name', function (t) {
  var key = 'getIntersectsWithSatellineName';
  nock.back('simple-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.simple(function (err, response) {
      nockDone();
      t.is(response.meta.found, 53);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

