'use strict';

process.env.ES_HOST = 'localhost:9200';

const _ = require('lodash');
const path = require('path');
const nock = require('nock');
const test = require('ava');
const Search = require('../index').api;
const payload = require('./events/simple.json');

test.before('setup nock', () => {
  nock.back.fixtures = path.join(__dirname, '/fixtures');
  nock.back.setMode(process.env.NOCK_BACK_MODE || 'lockdown');
});

test.cb.skip('test with invalid polygon', (t) => {
  const key = 'simpleGet';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload.getSelfIntersectingPolygon);
    search.simple((err) => {
      nockDone();
      t.is(err.message, 'Invalid Polgyon: self-intersecting');
      t.end();
    });
  });
});

test.cb.skip('root endpoint with simple GET should return 1 result', (t) => {
  const key = 'simpleGet';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.true(_.has(response.results[0], 'scene_id'));
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with simple POST should return 1 result', (t) => {
  const key = 'simplePost';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.true(_.has(response.results[0], 'scene_id'));
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with simple post limit 2 and fields', (t) => {
  const key = 'simplePostLimit2WithFields';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
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

test.cb.skip('root endpoint with simple POST with limit 2 should return 2 resul', (t) => {
  const key = 'simplePostLimit2';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.limit, 2);
      t.is(response.results.length, 2);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint with POST date range', (t) => {
  const key = 'postDatRange';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 454226);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 0', (t) => {
  const key = 'postIntersects_coverage_zero';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 237);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 50', (t) => {
  const key = 'postIntersects_coverage_50';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 8);
      t.is(response.meta.limit, 10);
      t.is(response.results.length, 8);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint POST intersects with aoi_coverage_percentage 100', (t) => {
  const key = 'postIntersects_coverage_100';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 3);
      t.is(response.meta.limit, 10);
      t.is(response.results.length, 3);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET intersects with no match', (t) => {
  const key = 'getIntersects';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 0);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 0);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET invalid intersect', (t) => {
  const key = 'getIntersectsInvalid';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err) => {
      nockDone();
      t.is(err.message, 'Invalid Geojson');
      t.end();
    });
  });
});

test.cb.skip('root endpoint GET string intersects', (t) => {
  const key = 'getIntersectsString';

  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 0);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 0);
      t.end(err);
    });
  });
});

test.cb.skip('root endpoint GET string intersects with satelline_name', (t) => {
  const key = 'getIntersectsWithSatellineName';
  nock.back(`simple-${key}.json`, (nockDone) => {
    const search = new Search(payload[key]);
    search.simple((err, response) => {
      nockDone();
      t.is(response.meta.found, 53);
      t.is(response.meta.limit, 1);
      t.is(response.results.length, 1);
      t.end(err);
    });
  });
});

