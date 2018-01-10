'use strict';

const got = require('got');
const path = require('path');
const moment = require('moment');
const pad = require('lodash.padstart');
const _ = require('lodash');
const local = require('kes/src/local');
const metadata = require('../../lib/metadata');
const Promise = require('bluebird');

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

function* ranges(...rangeDescriptors) {
  for (const [min, max, step = 1] of rangeDescriptors)
    for (let i = min; i < max; i += step)
      yield i;
}

function googleLinks(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  //const sceneId = data.sceneID;
  const productId = data.LANDSAT_PRODUCT_ID;

  const c1Console = `https://console.cloud.google.com/storage/browser/gcp-public-data-landsat/LC08/${path.join(_path, row, productId)}`;
  const c1Base = `https://storage.cloud.google.com/gcp-public-data-landsat/LC08/01/${path.join(_path, row, productId)}`;

  const c1Files = bands.map((b) => `${c1Base}/${productId}_${b}`);

  const c1 = {
    index: c1Console,
    files: c1Files
  };

  return { c1 };
}

function awsLinks_c1(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  const sceneId = data.sceneID;;
  const productId = data.LANDSAT_PRODUCT_ID;
  const c1Base = `https://landsat-pds.s3.amazonaws.com/c1/L8/${path.join(_path, row, productId)}`;
  const c1Files = bands.map((b) => `${c1Base}/${productId}_${b}`);

  const c1 = {
    index: `${c1Base}/index.html`,
    files: c1Files,
    thumbnail: `${c1Base}/${productId}_thumb_large.jpg`
  };

  return { c1 };
}

//! Check to see if a URL exists
function urlExists(url) {
  return new Promise(function(resolve, reject) {
    got(url).then(response => {
      resolve(url);
    }).catch(e => {
      reject(url);
    });
  });
}

//! iterate over an array synchronously, invoke function on each element 
function arrayIterate(values, fn) {
  return new Promise(function(resolve, reject) {
    // Are there any values to check?
    if(values.length === 0) {
      // All were rejected
      reject();
    }
    // Try the first value
    fn(values[0]).then(function(val) {
      // Resolved, we're all done
      //console.log('Resolved ' + val);
      resolve(val);
    }).catch(function() {
      // Rejected, remove the first item from the array and recursively
      // try the next one
      //console.log('Rejected ' + values[0]);
      values.shift();
      arrayIterate(values, fn).then(resolve).catch(reject);
    });
  });
}

function awsLinks_pre(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  const _sceneId = data.sceneID;
  const sceneId = _sceneId.slice(0, -2);
  const rev = _sceneId.slice(-2)
  var prefix = `http://landsat-pds.s3.amazonaws.com/L8/${path.join(_path, row, sceneId)}`;

  var links = _.range(rev, -1, -1).map(r => `${prefix}` + pad(r, 2, '0') + '/index.html');

  return new Promise((resolve, reject) => {
    arrayIterate(links, urlExists).then(val => {
      
      prefix = prefix + val.slice(-13, -11);
      const pre = {
        index: `${prefix}/index.html`,
        files: bands.map((b) => `${prefix}_${b}`),
        thumbnail: `${prefix}/${sceneId}_thumb_large.jpg`
      };
      resolve(pre);
    }).catch(e => {
      console.log(`${prefix} not found on AWS`);
      console.log(e);
      reject(`${prefix} not found on AWS`);
    });    
  })

}

function transform (data, callback = () => {}) {
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
    'ROLL_ANGLE',
    'GEOMETRIC_RMSE_MODEL',
    'GEOMETRIC_RMSE_MODEL_X',
    'GEOMETRIC_RMSE_MODEL_Y',
    'COLLECTION_NUMBER',
    'CLOUD_COVER_LAND'
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
    google_index: google.c1.index
  };

  // AWS doesn't include all C1 scenes, we return the old urls for
  // any scenes that is before May 1 2017
  if (moment(customFields.date) > moment('2017-04-30')) {
    const aws_c1 = awsLinks_c1(data);
    customFields.download_links.aws_s3 = aws_c1.files;
    customFields.aws_thumbnail = aws_c1.thumbnail;
    customFields.aws_index = aws_c1.index;
  }
  else {
    awsLinks_pre(data).then(val =>{
      customFields.download_links.aws_s3 = val.files;
      customFields.aws_thumbnail = val.thumbnail;
      customFields.aws_index = val.index;    
    }).catch(e => {
      return callback(`${scene_id} not found on AWS`);
    });
    

  }

  //if (thumbnailUrl) {
    //customFields.thumbnail = url.resolve(thumbnailUrl, `${data.LANDSAT_PRODUCT_ID}.jpg`);
  //}

  return callback(null, Object.assign({}, customFields, data));
}

function handler (event, context, cb) {
  console.log('Landsat handler')
  metadata.update(event, transform, cb);
}

local.localRun(() => {
  console.log('running locally')
  const a = {
    bucket: 'sat-api',
    key: 'sat-api-legacy/csv/landsat',
    satellite: 'landsat',
    currentFileNum: 100,
    lastFileNum: 101,
    arn: 'arn:aws:states:us-east-1:552819999234:stateMachine:landsat-meta'
  };

  handler(a, null, (e, r) => {
    console.log(e, r);
  });
});

module.exports.handler = handler;
