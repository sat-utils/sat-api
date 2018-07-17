
'use strict'

//const got = require('got')
//const path = require('path')
//const moment = require('moment')
//const pad = require('lodash.padstart')
const _ = require('lodash')
//const AWS = require('aws-sdk')
const local = require('kes/src/local')
const satlib = require('sat-api-lib')

// Wrapper around streams.Transform
const through2 = require('through2')

const request = require('request')

// s3 client
//const s3 = new AWS.S3()

function download_json(url) {
  return new Promise((resolve, reject) => {
    request(url, (error, response, body) => {
      if (error) reject(error);
      if (response.statusCode != 200) {
        reject('Invalid status code <' + response.statusCode + '>')
      }
      resolve(body)
    })
  })
}

// @todo check async 
async function handler (event, context=null, cb=function(){}) {

  console.log(JSON.stringify(event))

  // create stream from transform function
  //var _transform = through2({'objectMode': true, 'consume': true}, transform)

  //const bucket = _.get(event, 'bucket')
  //const arn = _.get(event, 'arn', null)
  //const retries = _.get(event, 'retries', 0)

  // load stac item
  const stac_item_url = _.get(event, 'stac_item_url')
  const imported_stac_item = JSON.parse(await download_json(stac_item_url))
  console.log(imported_stac_item)
  console.log(imported_stac_item.geometry.coordinates[0][0][0][0])
  console.log(imported_stac_item.geometry.coordinates[0][0][0][1])
  console.log(imported_stac_item.geometry.coordinates[0][0][1][0])
  console.log(imported_stac_item.geometry.coordinates[0][0][1][1])
  
  // add collection
  // satlib.es.client is an async function
  satlib.es.client().then(async (client) => {
    console.log('Connected to ES')

    // Create a 'collection' index in ES
    satlib.es.putMapping(client, 'collections').catch((err) => {})

    // Check if we need to import collection
    const collection_exists = await client.exists({
      index: 'collections',
      type: 'doc',
      id: imported_stac_item.properties['c:id']
    })
    if( !collection_exists ) {
      // Read collection information and insert into ES
      console.log('Collection ', imported_stac_item.properties['c:id'],
                  'does not exist, importing')
      // Load collection from stac item
      const imported_collection = JSON.parse(await download_json(imported_stac_item.links.collection.href))
      console.log(imported_collection)
      console.log(imported_collection.properties['c:id'])

      // @todo repeating c:id parameter at first level, check 'c:id' passed to saveRecords below
      imported_collection['c:id'] = imported_collection.properties['c:id']

      // @todo check, had to remove index= named parameter
      satlib.es.saveRecords(client, [imported_collection], 'collections', 'c:id',
                            (err, updated, errors) => {
        if (err) console.log('Error: ', err)
      })
    } else {
      console.log('Collection', imported_stac_item.properties['c:id'],
                  'already imported');
    }

    // @todo here I should have a single stac item processing. Maybe
    // it is a good idea to process batches
    //satlib.ingestcsv.update({client, bucket, key, transform:_transform, cb, currentFileNum, lastFileNum, arn, retries})
    // Create a 'items' index in ES
    // @todo previously created in satlib.ingestcsv.update, once a day. Currently it is
    // called for every item processing, can be optimized
    // @todo errror in the first call, check.
    satlib.es.putMapping(client, 'items').catch((err) => {})
    satlib.es.saveRecords(client, [imported_stac_item], 'items', 'id', (err, updated, errors) => {
      if (err) console.log('Error: ', err)
    })
    
  })
}

// to execute locally
//   needs
//     const local = require('kes/src/local')
//   $ node index.js local
//  connection to ES require process.env.ES_HOST
local.localRun(() => {
  console.log('running locally')
  // test payload
  const a = {
    bucket: 'sat-api',
    stac_item_url: 'https://s3.amazonaws.com/cbers-stac/CBERS4/MUX/057/111/CBERS_4_MUX_20180713_057_111_L2.json'
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
