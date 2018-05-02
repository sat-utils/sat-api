'use strict'

const got = require('got')
const path = require('path')
const moment = require('moment')
const pad = require('lodash.padstart')
const _ = require('lodash')
const AWS = require('aws-sdk')
const local = require('kes/src/local')
const ingest = require('../../lib/ingest-csv');
var through2 = require('through2')

// s3 client
const s3 = new AWS.S3()


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
]


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
      values.shift();
      arrayIterate(values, fn).then(resolve).catch(reject);
    })
  })
}


function awsLinks(data) {
  // generates links for the data on AWS
  const row = pad(data.row, 3, '0')
  const _path = pad(data.path, 3, '0')
  const sceneId = data.sceneID
  const productId = data.LANDSAT_PRODUCT_ID

  const c1Base = `https://landsat-pds.s3.amazonaws.com/c1/L8/${path.join(_path, row, productId)}`
  //const c1Files = bands.map((b) => [{name: b.slice(0, -4), href: `${c1Base}/${productId}_${b}`}])
  const c1Files = _.fromPairs(bands.map(function(b) { return [b.slice(0,-4), {href: `${c1Base}/${productId}_${b}`}] }))
  c1Files.thumbnail = `${c1Base}/${productId}_thumb_large.jpg`

  const c1 = {
    index: `${c1Base}/index.html`,
    files: c1Files
  }

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
      var prefix = `http://landsat-pds.s3.amazonaws.com/L8/${path.join(_path, row, _sceneId)}`
      var links = _.range(rev, -1, -1).map(r => `${prefix}` + pad(r, 2, '0') + '/index.html')
      var files = _.fromPairs(bands.map(function(b) { return [b.slice(0,-4), {href: `${prefix}/${sid}_${b}`}] }))
      files.thumbnail = `${prefix}/${sid}_thumb_large.jpg`

      arrayIterate(links.reverse(), fileExists).then(val => {
        prefix = prefix + val.slice(-13, -11)
        sid = _sceneId + val.slice(-13, -11)
        const pre = {
          index: `${prefix}/index.html`,
          //files: bands.map((b) => [{name: b.slice(0, -4), href: `${prefix}/${sid}_${b}`}]),
          files: files
        }
        resolve(pre);
      }).catch(e => {
        reject(`${prefix} not available`);
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
    data[f] = parseFloat(data[f]);
  })

  const geometry = { // eslint-disable-line camelcase
    type: 'Polygon',
    coordinates: [[
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude],
      [data.upperLeftCornerLongitude, data.upperLeftCornerLatitude],
      [data.lowerLeftCornerLongitude, data.lowerLeftCornerLatitude],
      [data.lowerRightCornerLongitude, data.lowerRightCornerLatitude],
      [data.upperRightCornerLongitude, data.upperRightCornerLatitude]
    ]]
  }

  const leftLong = Math.min(data.lowerLeftCornerLongitude, data.upperLeftCornerLongitude)
  const rightLong = Math.max(data.lowerRightCornerLongitude, data.upperRightCornerLongitude)
  if (leftLong < -1000000) { //> rightLong) {
    console.log(`warning: skipping ${data.sceneID} for crossing 180th Meridian (${JSON.stringify(geometry)})`)
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
        collection: 'landsat-toa',
        provider: 'USGS',
        license: 'https://eros.usgs.gov/about-us/data-citation',
        datetime: start.toISOString(),
        start: start.toISOString(),
        end: end.toISOString(),
        // eo extension metadata
        //'datetime': (end - start)/2 + start
        'eo:platform': 'landsat-8',
        'eo:instrument': 'OLI_TIRS',
        'eo:cloud_cover': data.cloudCoverFull,
        links: [
          {rel: 'self', 'href': ''},
          {rel: 'index', 'href': info.index},
        ],
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
  console.log(event)
  // create stream from transform function
  var _transform = through2({'objectMode': true, 'consume': true}, transform)
  const bucket = _.get(event, 'bucket')
  const key = _.get(event, 'key')
  const currentFileNum = _.get(event, 'currentFileNum', 0)
  const lastFileNum = _.get(event, 'lastFileNum', 0)
  const arn = _.get(event, 'arn', null)
  const retries = _.get(event, 'retries', 0)
  ingest.update({bucket, key, currentFileNum, lastFileNum, arn, retries, cb, transform:_transform}) 
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
