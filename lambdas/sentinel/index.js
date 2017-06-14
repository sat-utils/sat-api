'use strict';

const got = require('got');
const proj4 = require('proj4');
const epsg = require('epsg');
const range = require('lodash.range');
const pad = require('lodash.padstart');
const moment = require('moment');
const local = require('kes/src/local');
const metadata = require('../../lib/metadata');

const awsBaseUrl = 'https://sentinel-s2-l1c.s3.amazonaws.com';

function getSceneId(date, mgrs, version = 0) {
  return `S2A_tile_${date.format('YYYYMMDD')}_${mgrs}_${version}`;
}

function parseMgrs(mgrs) {
  return {
    'utm_zone': parseInt(mgrs),
    'latitude_band': mgrs.slice(mgrs.length - 3, mgrs.length - 2),
    'grid_square': mgrs.slice(mgrs.length - 2, mgrs.length)
  };
}

function getProductUrl(date, productId) {
  const url = [
    awsBaseUrl,
    'products',
    date.format('YYYY'),
    date.format('M'),
    date.format('D'),
    productId
  ];

  return url.join('/');
}

function getTilePath(date, parsedMgrs) {
  return [
    'tiles',
    parsedMgrs.utm_zone,
    parsedMgrs.latitude_band,
    parsedMgrs.grid_square,
    date.format('YYYY'),
    date.format('M'),
    date.format('D'),
    0
  ].join('/');
}

function getTileUrl(tilePath) {
  return `${awsBaseUrl}/${tilePath}`;
}

async function getSentinelInfo(url) {
  return got(url, { json: true });
}

function reproject(geojson) {
  const crs = geojson.crs.properties.name.replace(
    'urn:ogc:def:crs:', ''
  ).replace('8.8.1:', '');
  const from = epsg[crs];
  const to = proj4.default('EPSG:4326');

  if (geojson.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: [geojson.coordinates[0].map(c => proj4.default(from, to, c))]
    };
  }
  else if (geojson.type === 'Point') {
    return {
      type: 'Point',
      coordinates: proj4.default(from, to, geojson.coordinates)
    };
  }

  return geojson;
}

function transform(data, callback) {
  const record = {};
  const date = moment(data.SENSING_TIME);
  const mgrs = data.MGRS_TILE;
  const parsedMgrs = parseMgrs(mgrs);
  const tilePath = getTilePath(date, parsedMgrs);
  const tileBaseUrl = getTileUrl(tilePath);
  const tileMetaUrl = `${tileBaseUrl}/tileInfo.json`;
  const bands = range(1, 13).map(i => pad(i, 3, 'B0'));
  bands.push('B8A');

  getSentinelInfo(tileMetaUrl).then((info) => {
    info = info.body;
    record.scene_id = getSceneId(date, mgrs);
    record.product_id = data.PRODUCT_ID;
    record.satellite_name = 'Sentinel-2A';
    record.cloud_coverage = parseFloat(data.CLOUD_COVER);
    record.date = date.format('YYYY-MM-DD');
    record.thumbnail = `${tileBaseUrl}/preview.jpg`;
    record.data_geometry = reproject(info.tileDataGeometry);
    record.download_links = {
      'aws_s3': bands.map((b) => `${tileBaseUrl}/${b}.jp2`)
    };
    record.original_scene_id = data.GRANULE_ID;
    record.data_coverage_percentage = info.dataCoveragePercentage;
    record.cloudy_pixel_percentage = info.cloudyPixelPercentage;
    record.utm_zone = parsedMgrs.utm_zone;
    record.latitude_band = parsedMgrs.latitude_band;
    record.grid_square = parsedMgrs.grid_square;
    record.product_path = info.productPath;
    record.timestamp = info.timestamp;
    record.spacecraft_name = record.satellite_name;
    record.product_meta_link = `${getProductUrl(date, record.product_name)}/metadata.xml`;
    record.original_tile_meta = tileMetaUrl;
    record.aws_path = tilePath;
    record.tile_geometry = reproject(info.tileGeometry);
    record.tileOrigin = reproject(info.tileOrigin);

    callback(null, record);
  }).catch(e => callback(e));
}

function handler(event, context, cb) {
  metadata.update(event, transform, cb);
}

local.localRun(() => {
  const a = {
    bucket: 'devseed-kes-deployment',
    key: 'csv/sentinel',
    satellite: 'sentinel',
    currentFileNum: 200,
    lastFileNum: 200,
    direction: 'desc',
    arn: 'arn:aws:states:us-east-1:552819999234:stateMachine:landsat-meta'
  };

  handler(a, null, (e, r) => {
    console.log(e, r);
  });
});

module.exports.handler = handler;
