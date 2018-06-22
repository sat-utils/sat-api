'use strict'

const got = require('got')
const proj4 = require('proj4')
const epsg = require('epsg')
const kinks = require('turf-kinks')
const range = require('lodash.range')
const pad = require('lodash.padstart')
const moment = require('moment')
const through2 = require('through2')
const satlib = require('sat-api-lib')
const local = require('kes/src/local')


const collection = {
  "cx:id": "sentinel-2-l1c",
  "cx:name": "Sentinel 2 L1C",
  "cx:description": "Sentinel-2a and Sentinel-2b imagery",
  "provider": "ESA",
  "license": "https://sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice",
  "eo:gsd": 10,
  "eo:instrument": "MSI",
  "eo:off_nadir": 0,
  "eo:bands": {
    "B01": {
      "common_name": "coastal",
      "gsd": 60.0,
      "center_wavelength": 0.4439,
      "full_width_half_max": 0.027
    },
    "B02": {
      "common_name": "blue",
      "gsd": 10.0,
      "center_wavelength": 0.4966,
      "full_width_half_max": 0.098
    },
    "B03": {
      "common_name": "green",
      "gsd": 10.0,
      "center_wavelength": 0.56,
      "full_width_half_max": 0.045
    },
    "B04": {
      "common_name": "red",
      "gsd": 10.0,
      "center_wavelength": 0.6645,
      "full_width_half_max": 0.038
    },
    "B05": {
      "gsd": 20.0,
      "center_wavelength": 0.7039,
      "full_width_half_max": 0.019
    },
    "B06": {
      "gsd": 20.0,
      "center_wavelength": 0.7402,
      "full_width_half_max": 0.018
    },
    "B07": {
      "gsd": 20.0,
      "center_wavelength": 0.7825,
      "full_width_half_max": 0.028
    },
    "B08": {
      "common_name": "nir",
      "gsd": 10.0,
      "center_wavelength": 0.8351,
      "full_width_half_max": 0.145
    },
    "B8A": {
      "gsd": 20.0,
      "center_wavelength": 0.8648,
      "full_width_half_max": 0.033
    },
    "B09": {
      "gsd": 60.0,
      "center_wavelength": 0.945,
      "full_width_half_max": 0.026
    },
    "B10": {
      "common_name": "cirrus",
      "gsd": 60.0,
      "center_wavelength": 1.3735,
      "full_width_half_max": 0.075
    },
    "B11": {
      "common_name": "swir16",
      "gsd": 20.0,
      "center_wavelength": 1.6137,
      "full_width_half_max": 0.143
    },
    "B12": {
      "common_name": "swir22",
      "gsd": 20.0,
      "center_wavelength": 2.22024,
      "full_width_half_max": 0.242
    }
  }
}


const awsBaseUrl = 'https://sentinel-s2-l1c.s3.amazonaws.com';


function parseMgrs(mgrs) {
  var vals = {
    'utm_zone': parseInt(mgrs),
    'latitude_band': mgrs.slice(mgrs.length - 3, mgrs.length - 2),
    'grid_square': mgrs.slice(mgrs.length - 2, mgrs.length)
  }
  const alphaVal = vals['latitude_band'].toLowerCase().charCodeAt(0) - 97 + 1
  if (alphaVal > 13) {
    // northern hemisphere
    vals['epsg'] = `326${vals.utm_zone}`
  } else {
    vals['epsg'] = `327${vals.utm_zone}`
  }
  return vals
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
  const dt = moment(data.SENSING_TIME)
  const mgrs = data.MGRS_TILE
  const parsedMgrs = parseMgrs(mgrs)
  const tilePath = getTilePath(dt, parsedMgrs)
  const tileBaseUrl = getTileUrl(tilePath)
  const bands = range(1, 13).map(i => pad(i, 3, 'B0'))
  bands.push('B8A')
  getSentinelInfo(`${tileBaseUrl}/tileInfo.json`).then((info) => {
    info = info.body
    const sat = info.productName.slice(0, 3)
    const satname = `Sentinel-2${sat.slice(-1)}`
    var val
    var files = _.fromPairs(bands.map(function(b) {
      val = {href: `${tileBaseUrl}/${b}.jp2`, "eo:bands": [b]}
      return [b, val]
    }))
    files.thumbnail = {href: `${tileBaseUrl}/preview.jpg`}
    files.tki = {href: `${tileBaseUrl}/TKI.jp2`, description: 'True Color Image'}
    files.metadata = {href: `${tileBaseUrl}/metadata.xml`}
    // reproject to EPSG:4326
    var geom = reproject(info.tileDataGeometry)
    const lons = geom['coordinates'][0].map((pt) => { return pt[0] })
    const lats = geom['coordinates'][0].map((pt) => { return pt[1] })
    const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    const record = {
      id: data.GRANULE_ID,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      geometry: geom,
      'cx:id': 'sentinel-2-l1c',
      datetime: dt.toISOString(),
      'eo:platform': satname,
      'eo:cloud_cover': parseInt(data.CLOUD_COVER),
      'eo:epsg': parsedMgrs.epsg,
      assets: files,
      links: {},
      'sentinel:product_id': data.PRODUCT_ID,
      //'sentinel:tile_geometry': reproject(info.tileGeometry),
      //'sentinel:tileOrigin': reproject(info.tileOrigin)
    }
    this.push(record)
    next()
  }).catch(e => {
    // don't want to break stream, just log and continue
    console.log(`error processing ${data.GRANULE_ID}: ${e}`)
    next()
  })
}


function handler(event, context=null, cb=function(){}) {
  console.log(JSON.stringify(event))
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
    satlib.es.saveRecords(client, [collection], index='collections', 'cx:id', (err, updated, errors) => {
      if (err) console.log('Error: ', err)
    })
    satlib.ingestcsv.update({client, bucket, key, transform:_transform, cb, currentFileNum, lastFileNum, arn, retries}) 
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
