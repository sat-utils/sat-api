'use strict';

const got = require('got');
const path = require('path');
const moment = require('moment');
const pad = require('lodash.padstart');
const _ = require('lodash');
const AWS = require('aws-sdk')
const local = require('kes/src/local');
const metadata = require('../../lib/metadata');
var through2 = require('through2')

const bands = [
  'ANG.txt',
  'B1.TIF',
  'B2.TIF',
  'B3.TIF',
  'B4.TIF',
  'B5.TIF',
  'B6.TIF',
  'B7.TIF',
  'B8.TIF',
  'B9.TIF',
  'B10.TIF',
  'B11.TIF',
  'BQA.TIF',
  'MTL.txt'
];

const s3 = new AWS.S3()

function googleLinks(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  //const sceneId = data.sceneID;
  const productId = data.LANDSAT_PRODUCT_ID;

  const c1Console = `https://console.cloud.google.com/storage/browser/gcp-public-data-landsat/LC08/01/${path.join(_path, row, productId)}`;
  const c1Base = `https://storage.googleapis.com/gcp-public-data-landsat/LC08/01/${path.join(_path, row, productId)}`;

  const c1Files = bands.map((b) => `${c1Base}/${productId}_${b}`);

  const c1 = {
    index: c1Console,
    files: c1Files
  };

  return { c1 };
}

//! Check to see if a URL exists
function fileExists(url) {
  var params = {
    Bucket: 'landsat-pds',
    Key: url.slice(36)
  }
  return new Promise(function(resolve, reject) {
    s3.headObject(params, function (err, metadata) {
      if (err && err.code === 'NotFound') {
        reject(url)
      } else {
        resolve(url)
      }
    })
  })
  /*return new Promise(function(resolve, reject) {
    got(url).then(response => {
      resolve(url);
    }).catch(e => {
      reject(url);
    });
  });*/
}

Array.prototype.swap = function (x,y) {
  var b = this[x];
  this[x] = this[y];
  this[y] = b;
  return this;
}

//! iterate over an array synchronously, invoke function on each element 
function arrayIterate(values, fn) {
  return new Promise(function(resolve, reject) {
    // Are there any values to check?
    if (values.length === 0) {
      // All were rejected
      reject();
    }
    // Try the first value
    fn(values[0]).then(function(val) {
      // Resolved, we're all done
      resolve(val);
    }).catch(function() {
      // Rejected, remove the first item from the array and recursively
      // try the next one
      values.shift();
      arrayIterate(values, fn).then(resolve).catch(reject);
    });
  });
}

function awsLinks(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  const sceneId = data.sceneID;
  const productId = data.LANDSAT_PRODUCT_ID;

  const c1Base = `https://landsat-pds.s3.amazonaws.com/c1/L8/${path.join(_path, row, productId)}`;
  const c1Files = bands.map((b) => `${c1Base}/${productId}_${b}`);

  const c1 = {
    index: `${c1Base}/index.html`,
    files: c1Files,
    thumbnail: `${c1Base}/${productId}_thumb_large.jpg`
  };

  return new Promise(function(resolve, reject) {
    // AWS doesn't include all C1 scenes, we return the old urls for
    // any scenes that is before May 1 2017
    info = {};
    if (moment(data.acquisitionDate) > moment('2017-04-30')) {
      resolve(c1)
    } else {
      const _sceneId = sceneId.slice(0, -2);
      var sid;
      const rev = sceneId.slice(-2)
      var prefix = `http://landsat-pds.s3.amazonaws.com/L8/${path.join(_path, row, _sceneId)}`;
      var links = _.range(rev, -1, -1).map(r => `${prefix}` + pad(r, 2, '0') + '/index.html');
      if (links.length > 1) {
        links.swap(0, 1)
      }

      arrayIterate(links, fileExists).then(val => {
        prefix = prefix + val.slice(-13, -11)
        sid = _sceneId + val.slice(-13, -11)
        const pre = {
          index: `${prefix}/index.html`,
          files: bands.map((b) => `${prefix}/${sid}_${b}`),
          thumbnail: `${prefix}/${sid}_thumb_large.jpg`
        };
        resolve(pre);
      }).catch(e => {
        reject(`${prefix} not available`);
      });   
    }
  });
}

function transform(data, encoding, next) {
  const numberFields = [
    'cloudCoverFull',
    'path',
    'row',
    'upperLeftCornerLatitude',
    'upperLeftCornerLongitude',
    'upperRightCornerLatitude',
    'upperRightCornerLongitude',
    'lowerLeftCornerLatitude',
    'lowerLeftCornerLongitude',
    'lowerRightCornerLatitude',
    'lowerRightCornerLongitude',
    'sceneCenterLatitude',
    'sceneCenterLongitude',
    'cloudCover',
    'sunElevation',
    'sunAzimuth',
    'receivingStation',
    'imageQuality1',
    //'ROLL_ANGLE',
    //'GEOMETRIC_RMSE_MODEL',
    //'GEOMETRIC_RMSE_MODEL_X',
    //'GEOMETRIC_RMSE_MODEL_Y',
    //'COLLECTION_NUMBER',
    //'CLOUD_COVER_LAND'
  ];

  numberFields.forEach(f => {
    data[f] = parseFloat(data[f]);
  });

  const data_geometry = { // eslint-disable-line camelcase
    type: 'Polygon',
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:EPSG:8.9:4326'
      }
    },
    coordinates: [[
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude],
      [data.upperLeftCornerLongitude, data.upperLeftCornerLatitude],
      [data.lowerLeftCornerLongitude, data.lowerLeftCornerLatitude],
      [data.lowerRightCornerLongitude, data.lowerRightCornerLatitude],
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude]
    ]]
  };

  const leftLong = Math.min(data.lowerLeftCornerLongitude, data.upperLeftCornerLongitude)
  const rightLong = Math.max(data.lowerRightCornerLongitude, data.upperRightCornerLongitude)
  if (leftLong > rightLong) {
    console.log(`warning: skipping ${data.sceneID} for crossing 180th Meridian (${JSON.stringify(data_geometry)})`)
    next()
  } else {
    const google = googleLinks(data);

    const customFields = {
      scene_id: data.sceneID,
      product_id: data.LANDSAT_PRODUCT_ID,
      satellite_name: 'landsat-8',
      cloud_coverage: data.cloudCoverFull,
      date: data.acquisitionDate,
      thumbnail: data.browseURL,
      data_geometry,
      download_links: {
        usgs: `https://earthexplorer.usgs.gov/download/12864/${data.sceneID}/STANDARD/EE`,
        aws_s3: [],
        google: google.c1.files
      },
      aws_thumbnail: null,
      aws_index: null,
      google_index: google.c1.index,
    };

    delete data.cloudCoverFull

    awsLinks(data).then((info) => {
      //console.log('awslinks', info)
      customFields.download_links.aws_s3 = info.files
      customFields.aws_thumbnail = info.thumbnail
      customFields.aws_index = info.index
      record = Object.assign({}, customFields, data)
      this.push(record)
      next()
    }).catch(e => {
      console.log(`error processing ${customFields.scene_id}: ${e}`)
      next()
    })
  }

  //if (thumbnailUrl) {
  //customFields.thumbnail = url.resolve(thumbnailUrl, `${data.LANDSAT_PRODUCT_ID}.jpg`);
  //}
}

function handler (event, context, cb) {
  var _transform = through2({'objectMode': true, 'consume': true}, transform)
  console.log('Landsat handler:', event)
  metadata.update(event, _transform, cb)
}

local.localRun(() => {
  const a = {
    bucket: 'sat-api',
    key: 'testing',
    satellite: 'landsat',
    currentFileNum: 293222212,
    lastFileNum: 293222212
  };
  console.log('running locally')

  handler(a, null, (e, r) => {});
});

module.exports.handler = handler;
