'use strict';

const path = require('path');
const moment = require('moment');
const pad = require('lodash.padstart');
const local = require('kes/src/local');
const metadata = require('../../lib/metadata');

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

function awsLinks(data) {
  const row = pad(data.row, 3, '0');
  const _path = pad(data.path, 3, '0');
  const sceneId = data.sceneID;
  const productId = data.LANDSAT_PRODUCT_ID;
  const c1Base = `https://landsat-pds.s3.amazonaws.com/c1/L8/${path.join(_path, row, productId)}`;
  const preBase = `http://landsat-pds.s3.amazonaws.com/L8/${path.join(_path, row, sceneId)}`;

  const preFiles = bands.map((b) => `${preBase}/${sceneId}_${b}`);
  const c1Files = bands.map((b) => `${c1Base}/${productId}_${b}`);

  const pre = {
    index: `${preBase}/index.html`,
    files: preFiles,
    thumbnail: `${preBase}/${sceneId}_thumb_large.jpg`
  };

  const c1 = {
    index: `${c1Base}/index.html`,
    files: c1Files,
    thumbnail: `${c1Base}/${productId}_thumb_large.jpg`
  };

  return { pre, c1 };
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

  const aws = awsLinks(data);
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
    customFields.download_links.aws_s3 = aws.c1.files;
    customFields.aws_thumbnail = aws.c1.thumbnail;
    customFields.aws_index = aws.c1.index;
  }
  else {
    customFields.download_links.aws_s3 = aws.pre.files;
    customFields.aws_thumbnail = aws.pre.thumbnail;
    customFields.aws_index = aws.pre.index;
  }

  //if (thumbnailUrl) {
    //customFields.thumbnail = url.resolve(thumbnailUrl, `${data.LANDSAT_PRODUCT_ID}.jpg`);
  //}

  return callback(null, Object.assign({}, customFields, data));
}

function handler (event, context, cb) {
  metadata.update(event, transform, cb);
}

local.localRun(() => {
  const a = {
    bucket: 'devseed-kes-deployment',
    key: 'csv/landsat',
    satellite: 'landsat',
    currentFileNum: 0,
    lastFileNum: 100,
    arn: 'arn:aws:states:us-east-1:552819999234:stateMachine:landsat-meta'
  };

  handler(a, null, (e, r) => {
    console.log(e, r);
  });
});

module.exports.handler = handler;
