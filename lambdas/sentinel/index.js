'use strict'

const got = require('got')
const proj4 = require('proj4')
const epsg = require('epsg')
const kinks = require('turf-kinks')
const range = require('lodash.range')
const pad = require('lodash.padstart')
const moment = require('moment')
const local = require('kes/src/local')
const util = require('util')
var through2 = require('through2')
const satlib = require('sat-api-lib')

const collection = {
  "collection": "sentinel-2",
  "description": "Sentinel-2a and Sentinel-2b imagery",
  "provider": "ESA",
  "license": "",
  "eo:gsd": 10,
  "eo:instrument": "MSI",
  "eo:off_nadir": 0,
  "eo:bands": {
    "B01": {
      "common_name": "",
      "gsd": 10.0,
      "accuracy": null,
      "center_wavelength": 0,
      "full_width_half_max": 0
    },
    "B02": {
      "common_name": "",
      "gsd": 10.0,
      "accuracy": null,
      "center_wavelength": 0,
      "full_width_half_max": 0
    },
    "B03": {
      "common_name": "",
      "gsd": 10.0,
      "accuracy": null,
      "center_wavelength": 0,
      "full_width_half_max": 0
    },
    "B04": {
      "common_name": "",
      "gsd": 10.0,
      "accuracy": null,
      "center_wavelength": 0,
      "full_width_half_max": 0
    },
    "B05": {
      "common_name": "",
      "gsd": 10.0,
      "accuracy": null,
      "center_wavelength": 0,
      "full_width_half_max": 0
    }
  }
}

const awsBaseUrl = 'https://sentinel-s2-l1c.s3.amazonaws.com';

function getSceneId(sat, date, mgrs, version = 0) {
  return `${sat}_tile_${date.format('YYYYMMDD')}_${mgrs}_${version}`;
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

  return url.join('/')
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

function getSentinelInfo(url) {
  /*return new Promise(function(resolve, reject) {
    got(url, { json: true }).then(response => {
      resolve(response)
    }).catch(e => {
      console.log(`error getting metadata: ${e}`)
      resolve()
    })
  })*/
  return got(url, { json: true });
}

function reproject(geojson) {
  const crs = geojson.crs.properties.name.replace(
    'urn:ogc:def:crs:', ''
  ).replace('8.8.1:', '');
  const from = epsg[crs];
  //const to = proj4.default.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
  const to = '+proj=longlat +datum=WGS84 +over'

  //console.log(`${geojson.type} ${JSON.stringify(geojson)}`)
  if (geojson.type === 'Polygon') {
    geojson = {
      type: 'Polygon',
      coordinates: [geojson.coordinates[0].map(c => proj4.default(from, to, c))]
    };
  }
  else if (geojson.type === 'Point') {
    geojson = {
      type: 'Point',
      coordinates: proj4.default(from, to, geojson.coordinates)
    };
  } else {
    throw Error(`cannot process non Point or Polygon geometries`)
  }
  if (kinks(geojson).features.length > 0) {
    throw Error(`self-intersecting polygon`)
  }
  return geojson
}

function transform(data, encoding, next) {
  const date = moment(data.SENSING_TIME)
  const mgrs = data.MGRS_TILE
  const parsedMgrs = parseMgrs(mgrs)
  const tilePath = getTilePath(date, parsedMgrs)
  const tileBaseUrl = getTileUrl(tilePath)
  const tileMetaUrl = `${tileBaseUrl}/tileInfo.json`
  const bands = range(1, 13).map(i => pad(i, 3, 'B0'))
  bands.push('B8A')
  console.log('date mgrs', date, mgrs)
  getSentinelInfo(tileMetaUrl).then((info) => {
    info = info.body
    const sat = info.productName.slice(0, 3)
    const satname = `Sentinel-2${sat.slice(-1)}`
    const record = {
      id: getSceneId(sat, date, mgrs),
      bbox: [],
      geometry: reproject(info.tileDataGeometry),
      collection: 'sentinel-2',
      datetime = date.format('YYYY-MM-DD'),
      cloud_cover = parseFloat(data.CLOUD_COVER),
      thumbnail = `${tileBaseUrl}/preview.jpg`,
      assets = bands.map((b) => `${tileBaseUrl}/${b}.jp2`),
      links: [
        {rel: 'collection', 'href': '/collections?id=sentinel-2'}
      ],
      'eo:platform': satname,
      'sentinel:product_id': data.PRODUCT_ID,
      'sentinel:timestamp': info.timestamp,
      'sentinel:original_scene_id': data.GRANULE_ID,
      'sentinel:utm_zone': parsedMgrs.utm_zone,
      'sentinel:tile_geometry': reproject(info.tileGeometry),
      'sentinel:tileOrigin': reproject(info.tileOrigin)
    }
    this.push(record)
    next()
  }).catch(e => {
    // don't want to break stream, just log and continue
    console.log(`error processing ${data.PRODUCT_ID}: ${e}`)
    next()
  })
}


function handler(event, context=null, cb=function(){}) {
  console.log(event)
  const bucket = _.get(event, 'bucket')
  const key = _.get(event, 'key')
  const currentFileNum = _.get(event, 'currentFileNum', 0)
  const lastFileNum = _.get(event, 'lastFileNum', 0)
  const arn = _.get(event, 'arn', null)
  const retries = _.get(event, 'retries', 0)
  var _transform = through2({'objectMode': true}, transform)

  // add collection
  satlib.es.client().then((client) => {
    satlib.es.putMapping(client, 'collections').catch((err) => {})
    collection.id = collection.collection
    satlib.es.saveRecords(client, [collection], index='collections', (err, updated, errors) => {
      console.log('err', err)
      console.log('updated', updated)
      console.log('errors', errors)
    })
    satlib.ingest.update({bucket, key, transform:_transform, cb, currentFileNum, lastFileNum, arn, retries}) 
  })
}


// running locally
local.localRun(() => {
  const a = {
    bucket: 'sat-api',
    key: 'testing/sentinel',
    currentFileNum: 1,
    lastFileNum: 1
  };

  handler(a, null, (err, r) => {
    if (err) {
      console.log(`error: ${e}`)
    } else {
      console.log(`success: ${r}`)
    }
  })
});


module.exports.handler = handler;
