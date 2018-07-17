'use strict'

const got = require('got')
const proj4 = require('proj4')
const epsg = require('epsg')
const kinks = require('turf-kinks')
const range = require('lodash.range')
const pad = require('lodash.padstart')
const moment = require('moment')
const through2 = require('through2')
const clone = require('lodash.clonedeep')
const fromPairs = require('lodash.frompairs')
const get = require('lodash.get')
const satlib = require('@sat-utils/api-lib')

const collection = {
  'c:id': 'sentinel-2-l1c',
  'c:name': 'Sentinel 2 L1C',
  'c:description': 'Sentinel-2a and Sentinel-2b imagery',
  provider: 'ESA',
  license: 'https://sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice',
  'eo:gsd': 10,
  'eo:instrument': 'MSI',
  'eo:off_nadir': 0,
  'eo:bands': {
    B01: {
      common_name: 'coastal',
      gsd: 60.0,
      center_wavelength: 0.4439,
      full_width_half_max: 0.027
    },
    B02: {
      common_name: 'blue',
      gsd: 10.0,
      center_wavelength: 0.4966,
      full_width_half_max: 0.098
    },
    B03: {
      common_name: 'green',
      gsd: 10.0,
      center_wavelength: 0.56,
      full_width_half_max: 0.045
    },
    B04: {
      common_name: 'red',
      gsd: 10.0,
      center_wavelength: 0.6645,
      full_width_half_max: 0.038
    },
    B05: {
      gsd: 20.0,
      center_wavelength: 0.7039,
      full_width_half_max: 0.019
    },
    B06: {
      gsd: 20.0,
      center_wavelength: 0.7402,
      full_width_half_max: 0.018
    },
    B07: {
      gsd: 20.0,
      center_wavelength: 0.7825,
      full_width_half_max: 0.028
    },
    B08: {
      common_name: 'nir',
      gsd: 10.0,
      center_wavelength: 0.8351,
      full_width_half_max: 0.145
    },
    B8A: {
      gsd: 20.0,
      center_wavelength: 0.8648,
      full_width_half_max: 0.033
    },
    B09: {
      gsd: 60.0,
      center_wavelength: 0.945,
      full_width_half_max: 0.026
    },
    B10: {
      common_name: 'cirrus',
      gsd: 60.0,
      center_wavelength: 1.3735,
      full_width_half_max: 0.075
    },
    B11: {
      common_name: 'swir16',
      gsd: 20.0,
      center_wavelength: 1.6137,
      full_width_half_max: 0.143
    },
    B12: {
      common_name: 'swir22',
      gsd: 20.0,
      center_wavelength: 2.22024,
      full_width_half_max: 0.242
    }
  }
}


const awsBaseUrl = 'https://sentinel-s2-l1c.s3.amazonaws.com'


function parseMgrs(mgrs) {
  const vals = {
    utm_zone: parseInt(mgrs),
    latitude_band: mgrs.slice(mgrs.length - 3, mgrs.length - 2),
    grid_square: mgrs.slice(mgrs.length - 2, mgrs.length)
  }
  let alphaVal = vals.latitude_band.toLowerCase().charCodeAt(0)
  alphaVal = (alphaVal - 97) + 1
  if (alphaVal > 13) {
    // northern hemisphere
    vals.epsg = `326${vals.utm_zone}`
  }
  else {
    vals.epsg = `327${vals.utm_zone}`
  }
  return vals
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
  ].join('/')
}


function getTileUrl(tilePath) {
  return `${awsBaseUrl}/${tilePath}`
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
  return got(url, { json: true })
}


function reproject(inputGeojson) {
  let geojson = clone(inputGeojson)
  const crs = geojson.crs.properties.name.replace(
    'urn:ogc:def:crs:', ''
  ).replace('8.8.1:', '')
  const from = epsg[crs]
  //const to = proj4.default.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
  const to = '+proj=longlat +datum=WGS84 +over'

  //console.log(`${geojson.type} ${JSON.stringify(geojson)}`)
  if (geojson.type === 'Polygon') {
    geojson = {
      type: 'Polygon',
      coordinates: [geojson.coordinates[0].map((c) => proj4.default(from, to, c))]
    }
  }
  else if (geojson.type === 'Point') {
    geojson = {
      type: 'Point',
      coordinates: proj4.default(from, to, geojson.coordinates)
    }
  }
  else {
    throw Error('cannot process non Point or Polygon geometries')
  }
  if (kinks(geojson).features.length > 0) {
    throw Error('self-intersecting polygon')
  }
  return geojson
}


function transform(data, encoding, next) {
  const dt = moment(data.SENSING_TIME)
  const mgrs = data.MGRS_TILE
  const parsedMgrs = parseMgrs(mgrs)
  const tilePath = getTilePath(dt, parsedMgrs)
  const tileBaseUrl = getTileUrl(tilePath)
  const bands = range(1, 13).map((i) => pad(i, 3, 'B0'))
  bands.push('B8A')
  getSentinelInfo(`${tileBaseUrl}/tileInfo.json`).then((body) => {
    const info = body
    const sat = info.productName.slice(0, 3)
    const satname = `Sentinel-2${sat.slice(-1)}`
    let val
    const files = fromPairs(bands.map((b) => {
      val = { href: `${tileBaseUrl}/${b}.jp2`, 'eo:bands': [b] }
      return [b, val]
    }))
    files.thumbnail = { href: `${tileBaseUrl}/preview.jpg` }
    files.tki = { href: `${tileBaseUrl}/TKI.jp2`, description: 'True Color Image' }
    files.metadata = { href: `${tileBaseUrl}/metadata.xml` }
    // reproject to EPSG:4326
    const geom = reproject(info.tileDataGeometry)
    const lons = geom.coordinates[0].map((pt) => pt[0])
    const lats = geom.coordinates[0].map((pt) => pt[1])
    const record = {
      id: data.GRANULE_ID,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      geometry: geom,
      'c:id': 'sentinel-2-l1c',
      datetime: dt.toISOString(),
      'eo:platform': satname,
      'eo:cloud_cover': parseInt(data.CLOUD_COVER),
      'eo:epsg': parsedMgrs.epsg,
      assets: files,
      links: {},
      'sentinel:product_id': data.PRODUCT_ID
      //'sentinel:tile_geometry': reproject(info.tileGeometry),
      //'sentinel:tileOrigin': reproject(info.tileOrigin)
    }
    this.push(record)
    next()
  }).catch((e) => {
    // don't want to break stream, just log and continue
    console.log(`error processing ${data.GRANULE_ID}: ${e}`)
    next()
  })
}


function handler(event, context, cb) {
  console.log(JSON.stringify(event))
  const bucket = get(event, 'bucket')
  const key = get(event, 'key')
  const currentFileNum = get(event, 'currentFileNum', 0)
  const lastFileNum = get(event, 'lastFileNum', 0)
  const arn = get(event, 'arn', null)
  const retries = get(event, 'retries', 0)
  const _transform = through2({ objectMode: true }, transform)

  // add collection
  let esClient
  return satlib.es.client()
    .then((client) => {
      esClient = client
      return satlib.es.putMapping(esClient, 'collections')
    })
    .then(() => satlib.es.saveRecords(esClient, [collection], 'collections', 'c:id'))
    .then(() => satlib.ingestcsv.update({
      esClient,
      bucket,
      key,
      transform: _transform,
      cb,
      currentFileNum,
      lastFileNum,
      arn,
      retries
    }))
    .catch((e) => console.log('Error: ', e))
}

module.exports.handler = handler
