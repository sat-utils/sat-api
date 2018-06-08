'use strict'

const got = require('got')
const path = require('path')
const moment = require('moment')
const pad = require('lodash.padstart')
const _ = require('lodash')
const AWS = require('aws-sdk')
const local = require('kes/src/local')
const satlib = require('sat-api-lib')
const through2 = require('through2')

// s3 client
const s3 = new AWS.S3()


const collection = {
  "collection": "landsat-8",
  "description": "Landat 8 imagery radiometrically calibrated and orthorectified using gound points and Digital Elevation Model (DEM) data to correct relief displacement.",
  "provider": "USGS",
  "license": "PDDL-1.0",
  "eo:gsd" : 30,
  "eo:platform": "landsat-8",
  "eo:instrument": "OLI_TIRS",
  "eo:off_nadir": 0,
  "eo:bands": {
    "B1": {
      "common_name": "coastal",
      "gsd": 30.0,
      "center_wavelength": 0.44,
      "full_width_half_max": 0.02
    },
    "B2": {
      "common_name": "blue",
      "gsd": 30.0,
      "center_wavelength": 0.48,
      "full_width_half_max": 0.06
    },
    "B3": {
      "common_name": "green",
      "gsd": 30.0,
      "center_wavelength": 0.56,
      "full_width_half_max": 0.06
    },
    "B4": {
      "common_name": "red",
      "gsd": 30.0,
      "center_wavelength": 0.65,
      "full_width_half_max": 0.04
    },
    "B5": {
      "common_name": "nir",
      "gsd": 30.0,
      "center_wavelength": 0.86,
      "full_width_half_max": 0.03
    },
    "B6": {
      "common_name": "swir16",
      "gsd": 30.0,
      "center_wavelength": 1.6,
      "full_width_half_max": 0.08
    },
    "B7": {
      "common_name": "swir22",
      "gsd": 30.0,
      "center_wavelength": 2.2,
      "full_width_half_max": 0.2
    },
    "B8": {
      "common_name": "pan",
      "gsd": 15.0,
      "center_wavelength": 0.59,
      "full_width_half_max": 0.18
    },
    "B9": {
      "common_name": "cirrus",
      "gsd": 30.0,
      "center_wavelength": 1.37,
      "full_width_half_max": 0.02
    },
    "B10": {
      "common_name": "lwir11",
      "gsd": 100.0,
      "center_wavelength": 10.9,
      "full_width_half_max": 0.8
    },
    "B11": {
      "common_name": "lwir12",
      "gsd": 100.0,
      "center_wavelength": 12.0,
      "full_width_half_max": 1.0
    }
  }
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
}

//! iterate over an array synchronously, invoke function on each element 
function arrayIterate(values, fn) {
  return new Promise(function(resolve, reject) {
    // Are there any values to check?
    if (values.length === 0) {
      // All were rejected
      reject()
    }
    // Try the first value
    fn(values[0]).then(function(val) {
      // Resolved, we're all done
      resolve(val)
    }).catch(function() {
      // Rejected, remove the first item from the array and recursively
      // try the next one
      values.shift()
      arrayIterate(values, fn).then(resolve).catch(reject)
    })
  })
}


function awsLinks(data) {
  // generates links for the data on AWS
  const row = pad(data.row, 3, '0')
  const _path = pad(data.path, 3, '0')
  const sceneId = data.sceneID
  const productId = data.LANDSAT_PRODUCT_ID

  var files = ['ANG.txt','B1.TIF','B2.TIF','B3.TIF','B4.TIF','B5.TIF','B6.TIF',
                 'B7.TIF','B8.TIF','B9.TIF','B10.TIF','B11.TIF','BQA.TIF','MTL.txt']
  var _bands = Object.keys(collection["eo:bands"])

  const c1Base = `https://landsat-pds.s3.amazonaws.com/c1/L8/${path.join(_path, row, productId)}`
  //const c1Files = bands.map((b) => [{name: b.slice(0, -4), href: `${c1Base}/${productId}_${b}`}])
  var key, val
  const c1Files = _.fromPairs(files.map(function(b) {
    key = b.slice(0,-4)
    val = {href: `${c1Base}/${productId}_${b}`}
    if (_bands.includes(key)) {
      val["eo:bands"] = [key]
    }
    return [key, val]
  }))
  c1Files.thumbnail = {href: `${c1Base}/${productId}_thumb_large.jpg`}

  const c1 = {
    index: `${c1Base}/index.html`,
    files: c1Files
  }

  return new Promise(function(resolve, reject) {
    // AWS doesn't include all C1 scenes, we return the old urls for
    // any scenes that is before May 1 2017
    info = {}
    if (moment(data.acquisitionDate) > moment('2017-04-30')) {
      resolve(c1)
    } else {
      const _sceneId = sceneId.slice(0, -2)
      var sid, key
      const rev = sceneId.slice(-2)
      var prefix = `http://landsat-pds.s3.amazonaws.com/L8/${path.join(_path, row, _sceneId)}`
      var links = _.range(rev, -1, -1).map(r => `${prefix}` + pad(r, 2, '0') + '/index.html')

      arrayIterate(links.reverse(), fileExists).then(val => {
        prefix = prefix + val.slice(-13, -11)
        sid = _sceneId + val.slice(-13, -11)
        files = _.fromPairs(files.map((b) => {
          key = b.slice(0,-4)
          val = {href: `${prefix}/${sid}_${b}`}
          if (_bands.includes(key)) {
            val["eo:bands"] = [key]
          }
          return [key, val]
        }))
        files.thumbnail = {href: `${prefix}/${sid}_thumb_large.jpg`}
        const pre = {
          index: `${prefix}/index.html`,
          files: files
        }
        resolve(pre)
      }).catch((err) => {
        reject(`${prefix} not available: `, err)
      })   
    }
  })
}


function transform(data, encoding, next) {

  // concert numeric fields to numbers
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
  ]
  numberFields.forEach(f => {
    data[f] = parseFloat(data[f])
  })

  const geometry = {
    type: 'Polygon',
    coordinates: [[
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude],
      [data.upperLeftCornerLongitude, data.upperLeftCornerLatitude],
      [data.lowerLeftCornerLongitude, data.lowerLeftCornerLatitude],
      [data.lowerRightCornerLongitude, data.lowerRightCornerLatitude],
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude]
    ]]
  }

  // check for crossing antimeridian
  const leftLong = Math.min(data.lowerLeftCornerLongitude, data.upperLeftCornerLongitude)
  const rightLong = Math.max(data.lowerRightCornerLongitude, data.upperRightCornerLongitude)
  if (leftLong < -1000000) { //> rightLong) {
    console.log(`warning: skipping ${data.sceneID} for crossing 180th Meridian (${JSON.stringify(geometry)})`)
    next()
  } else if ((moment(data.acquisitionDate) < moment('2013-05-26'))) {
    console.log(`skipping pre-service data ${data.sceneID}`)
    next()
  } else {
    awsLinks(data).then((info) => {
      const start = moment(data.sceneStartTime, "YYYY:DDD:HH:mm:ss.SSSSS")
      const end = moment(data.sceneStopTime, "YYYY:DDD:HH:mm:ss.SSSSS")
      const record = {
        id: data.LANDSAT_PRODUCT_ID,
        bbox: [
          data.lowerLeftCornerLongitude, data.lowerLeftCornerLatitude, data.upperRightCornerLongitude, data.upperRightCornerLatitude
        ],
        geometry: geometry,
        collection: 'landsat-8',
        datetime: start.toISOString(),
        //'datetime': (end - start)/2 + start
        // eo extension metadata
        'eo:cloud_cover': parseInt(data.cloudCoverFull),
        'eo:sun_azimuth': data.sunAzimuth,
        'eo:sun_elevation': data.sunElevation,
        links: {
          'index': {'href': info.index},
        },
        assets: info.files
      }
      this.push(record)
      next()
    }).catch(e => {
      console.log(`error processing ${data.sceneID}: ${e}`)
      next()
    })
  }
}


function handler (event, context=null, cb=function(){}) {
  console.log(JSON.stringify(event))
  // create stream from transform function
  var _transform = through2({'objectMode': true, 'consume': true}, transform)
  const bucket = _.get(event, 'bucket')
  const key = _.get(event, 'key')
  const currentFileNum = _.get(event, 'currentFileNum', 0)
  const lastFileNum = _.get(event, 'lastFileNum', 0)
  const arn = _.get(event, 'arn', null)
  const retries = _.get(event, 'retries', 0)

  // add collection
  satlib.es.client().then((client) => {
    satlib.es.putMapping(client, 'collections').catch((err) => {})
    satlib.es.saveRecords(client, [collection], index='collections', 'collection', (err, updated, errors) => {
      if (err) console.log('Error: ', err)
    })
    satlib.ingestcsv.update({client, bucket, key, transform:_transform, cb, currentFileNum, lastFileNum, arn, retries}) 
  })
}


local.localRun(() => {
  console.log('running locally')
  // test payload
  const a = {
    bucket: 'sat-api',
    key: 'testing/landsat',
    currentFileNum: 1,
    lastFileNum: 1
  }

  handler(a, null, (err, r) => {
    if (err) {
      console.log(`error: ${e}`)
    } else {
      console.log(`success: ${r}`)
    }
  })

})


module.exports.handler = handler
