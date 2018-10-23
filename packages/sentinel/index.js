'use strict'

const got = require('got')
const proj4 = require('proj4')
const epsg = require('epsg')
const kinks = require('turf-kinks')
const range = require('lodash.range')
const _ = require('lodash')
const pad = require('lodash.padstart')
const moment = require('moment')
const through2 = require('through2')
const clone = require('lodash.clonedeep')
const fromPairs = require('lodash.frompairs')
const get = require('lodash.get')
const satlib = require('@sat-utils/api-lib')

const collection = {
  id: 'sentinel-2-l1c',
  title: 'Sentinel 2 L1C',
  description: 'Sentinel-2a and Sentinel-2b imagery',
  keywords: ['sentinel', 'earth observation', 'esa'],
  version: '0.1.0',
  stac_version: satlib.api.stac_version,
  extent: {
    spatial: [-180, -90, 180, 90],
    temporal: ['2013-06-01', null]
  },
  provider: [{
    name: 'ESA', role: 'producer', href: 'https://sentinel.esa.int/web/sentinel/home'
  }, {
    name: 'Sinergise', role: 'processor', href: 'http://sentinel-pds.s3-website.eu-central-1.amazonaws.com/'
  }, {
    name: 'AWS', role: 'host', href: 'https://aws.amazon.com/blogs/publicsector/complete-sentinel-2-archives-freely-available-to-users/'
  }, {
    name: 'Development Seed', role: 'processor', url: 'https://github.com/sat-utils/sat-api'
  }],
  license: 'proprietary',
  properties: {
    collection: 'sentinel-2-l1c',
    'eo:gsd': 10,
    'eo:instrument': 'MSI',
    'eo:constellation': 'sentinel-2',
    'eo:off_nadir': 0,
    'eo:bands': [
      {
        id: 'B01',
        common_name: 'coastal',
        gsd: 60.0,
        center_wavelength: 0.4439,
        full_width_half_max: 0.027
      }, {
        id: 'B02',
        common_name: 'blue',
        gsd: 10.0,
        center_wavelength: 0.4966,
        full_width_half_max: 0.098
      }, {
        name: 'B03',
        common_name: 'green',
        gsd: 10.0,
        center_wavelength: 0.56,
        full_width_half_max: 0.045
      }, {
        id: 'B04',
        common_name: 'red',
        gsd: 10.0,
        center_wavelength: 0.6645,
        full_width_half_max: 0.038
      }, {
        id: 'B05',
        gsd: 20.0,
        center_wavelength: 0.7039,
        full_width_half_max: 0.019
      }, {
        id: 'B06',
        gsd: 20.0,
        center_wavelength: 0.7402,
        full_width_half_max: 0.018
      }, {
        id: 'B07',
        gsd: 20.0,
        center_wavelength: 0.7825,
        full_width_half_max: 0.028
      }, {
        id: 'B08',
        common_name: 'nir',
        gsd: 10.0,
        center_wavelength: 0.8351,
        full_width_half_max: 0.145
      }, {
        id: 'B8A',
        gsd: 20.0,
        center_wavelength: 0.8648,
        full_width_half_max: 0.033
      }, {
        id: 'B09',
        gsd: 60.0,
        center_wavelength: 0.945,
        full_width_half_max: 0.026
      }, {
        id: 'B10',
        common_name: 'cirrus',
        gsd: 60.0,
        center_wavelength: 1.3735,
        full_width_half_max: 0.075
      }, {
        id: 'B11',
        common_name: 'swir16',
        gsd: 20.0,
        center_wavelength: 1.6137,
        full_width_half_max: 0.143
      }, {
        id: 'B12',
        common_name: 'swir22',
        gsd: 20.0,
        center_wavelength: 2.22024,
        full_width_half_max: 0.242
      }
    ]
  },
  'assets': {
    'B01': { type: 'image/jp2', 'eo:bands': [0], title: 'Band 1 (coastal)' },
    'B02': { type: 'image/jp2', 'eo:bands': [1], title: 'Band 2 (blue)' },
    'B03': { type: 'image/jp2', 'eo:bands': [2], title: 'Band 3 (green)' },
    'B04': { type: 'image/jp2', 'eo:bands': [3], title: 'Band 4 (red)' },
    'B05': { type: 'image/jp2', 'eo:bands': [4], title: 'Band 5' },
    'B06': { type: 'image/jp2', 'eo:bands': [5], title: 'Band 6' },
    'B07': { type: 'image/jp2', 'eo:bands': [6], title: 'Band 7' },
    'B08': { type: 'image/jp2', 'eo:bands': [7], title: 'Band 8 (nir)' },
    'B8A': { type: 'image/jp2', 'eo:bands': [8], title: 'Band 8A' },
    'B09': { type: 'image/jp2', 'eo:bands': [9], title: 'Band 9' },
    'B10': { type: 'image/jp2', 'eo:bands': [10], title: 'Band 10 (cirrus)' },
    'B11': { type: 'image/jp2', 'eo:bands': [11], title: 'Band 11 (swir16)' },
    'B12': { type: 'image/jp2', 'eo:bands': [12], title: 'Band 12 (swir22)' }
  },
  links: [
    { rel: 'license', href: 'https://sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice' }
  ]
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


function _transform(data, encoding, next) {
  const dt = moment(data.SENSING_TIME)
  const mgrs = data.MGRS_TILE
  const parsedMgrs = parseMgrs(mgrs)
  const tilePath = getTilePath(dt, parsedMgrs)
  const tileBaseUrl = getTileUrl(tilePath)
  const rodaBaseUrl = tileBaseUrl.replace('sentinel-s2-l1c.s3.amazonaws.com', 'roda.sentinel-hub.com/sentinel-s2-l1c')
  const bands = range(1, 13).map((i) => pad(i, 3, 'B0'))
  bands.push('B8A')
  const tileInfo = `${rodaBaseUrl}/tileInfo.json`
  got(tileInfo, { json: true }).then((info) => {
    const sat = info.body.productName.slice(0, 3)
    const satname = `Sentinel-2${sat.slice(-1)}`
    let val
    const files = fromPairs(bands.map((b, i) => {
      val = { href: `${tileBaseUrl}/${b}.jp2`}
      return [b, val]
    }))
    files.thumbnail = { href: `${rodaBaseUrl}/preview.jpg` }
    files.tki = { href: `${tileBaseUrl}/TKI.jp2`, description: 'True Color Image' }
    files.metadata = { href: `${rodaBaseUrl}/metadata.xml` }
    // reproject to EPSG:4326
    const geom = reproject(info.body.tileDataGeometry)
    const lons = geom.coordinates[0].map((pt) => pt[0])
    const lats = geom.coordinates[0].map((pt) => pt[1])
    const record = {
      id: data.GRANULE_ID,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      geometry: geom,
      properties: {
        collection: 'sentinel-2-l1c',
        datetime: dt.toISOString(),
        'eo:platform': satname,
        'eo:cloud_cover': parseInt(data.CLOUD_COVER),
        'eo:epsg': parsedMgrs.epsg,
        'sentinel:product_id': data.PRODUCT_ID
        //'sentinel:tile_geometry': reproject(info.body.tileGeometry),
        //'sentinel:tile_origin': reproject(info.body.tileOrigin)
      },
      assets: _.merge({}, files, collection.assets),
      links: []
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
  const transform = through2({ objectMode: true }, _transform)

  // add collection
  satlib.es.saveCollection(collection)
    .then(() => {
      // ensure mapping exists
      satlib.es.prepare('items').then(() => {
        // add items from files
        satlib.ingestcsv.processFiles(
          { bucket, key,  transform, cb, currentFileNum, lastFileNum, arn, retries }
        )
    })
  })
  .catch((e) => console.log(e))
}

module.exports.handler = handler
