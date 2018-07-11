'use strict';
process.env.ES_HOST = 'localhost:9200';

var path = require('path');
var nock = require('nock');
var test = require('ava');
var Search = require('../index').api;
var payload = require('./events/count.json');

test.before('setup nock', function (t) {
  nock.back.fixtures = path.join(__dirname, '/fixtures');
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown');
});

test.cb.skip('count endpoint with simple GET should return 1 result', function (t) {
  var key = 'simpleGet';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 987449);
      t.end(err);
    });
  });
});

test.cb.skip('count endpoint with simple POST should return 1 result', function (t) {
  var key = 'simplePost';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 987449);
      t.end(err);
    });
  });
});

test.cb.skip('count endpoint with simple POST should return 2 result', function (t) {
  var key = 'simplePostLimit2';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 987449);
      t.end(err);
    });
  });
});

test.cb.skip('count endpoint POST intersects', function (t) {
  var key = 'postIntersects';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 237);
      t.end(err);
    });
  });
});

test.cb.skip('count endpoint GET intersects with no match', function (t) {
  var key = 'getIntersects';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 0);
      t.end(err);
    });
  });
});

test.cb.skip('count endpoint GET with fields', function (t) {
  var key = 'getFields';
  nock.back('count-' + key + '.json', function (nockDone) {
    var search = new Search(payload[key]);
    search.count(function (err, response) {
      nockDone();
      t.is(response.meta.found, 987449);
      t.is(response.counts.terms_latitude_band.sum_other_doc_count, 69738);
      t.is(response.counts.terms_satellite_name.buckets[0].doc_count, 709937);
      t.end(err);
    });
  });
});

