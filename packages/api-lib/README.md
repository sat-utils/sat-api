## @sat-utils/api-lib

We use this library for creating sat-api using API Gateway. You can use this API to build a standalone API in other frameworks such as Express

### Test

    $ npm install
    $ npm run test

We use [nock](https://github.com/node-nock/nock) to record and save API calls to the ElasticSearch instance to speed up tests and freeze results in time.

To change the behaviour of Nock, update `NOCK_BACK_MODE` to `wild`, `dryrun`, `record` or `lockdown`. More info [here](https://github.com/node-nock/nock#modes).

Default is `lockdown`.


### Express Example:

```js
process.env.ES_HOST = 'link-to-my-elasticsearh.com';

var express = require('express');
var api = require('sat-api-lib');
var app = express();

app.get('/', function(req, res) {
  var search = new api(req);
  search.simple(function (err, resp) {
    res.send(resp);
  });
});

app.get('/count', function(req, res) {
  var search = new api(req);
  search.count(function (err, resp) {
    res.send(resp);
  });
});

app.get('/geojson', function(req, res) {
  var search = new api(req);
  search.geojson(function (err, resp) {
    res.send(resp);
  });
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
```

### About
Sat API Lib was made by [Development Seed](http://developmentseed.org).
