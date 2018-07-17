const es = require("./../../lib/es")
const proj4 = require('proj4');
const epsg = require('epsg');
const fs = require('fs')
const rp = require('request-promise')
const _ = require('lodash')
const xmlParser = require('xml2json')
const pad = require('pad');
const q = require('q')
const gdal = require('gdal')
const camelcase = require('camelcase')


const S3_URI = "http://sentinel-s2-l1c.s3.amazonaws.com"
const ES_HOST = process.env.ES_HOST || 'search-sat-updater-test-3ghi3tga4tezvc3trjhnyq4ize.us-east-1.es.amazonaws.com'
const ES_PORT = process.env.ES_PORT || 9200
const ES_INDEX_NAME = process.env.ES_INDEX_NAME || 'sat-api-node'
const ES_TYPE = process.env.ES_TYPE || 'sentinel2'

var esClient;


function handler(event, context, callback){
  // called upon receipt of sns message
  var records = event.Records

  for (var i=0; i < records.length; i++){
    var theRecord = records[i]
    getMetadataForScene(theRecord)
      .then((metadata) =>{
        processMetadata(metadata)
          // saveMetadataToES(metadata)
      })
      .catch((err)=>{
          logError(err)
      })
  }
}

function getMetadataForScene(record){
    var defer = q.defer();
    var message = record['Sns']['Message']
    var productName = message.name
    var utmZone = message.utmZone
    var gridSquare = message.gridSquare
    var latitudeBand = message.latitudeBand
    var timeOfCapture = message.timestamp
    var pathToProductInfo = S3_URI + "/" + message.path + "/productInfo.json"
    var pathToMetadataXML = S3_URI + "/" + message.path + "/metadata.xml"
    var tiles = message.tiles
    var pathToTileInfo = _.map(tiles, "path")
    var calls = [getProductInfo(pathToProductInfo), getProductMetadata(pathToMetadataXML)]

    for (var i =0; i < pathToTileInfo.length; i++){
      var tileURL = S3_URI + "/" + pathToTileInfo[i] + "/tileInfo.json"
      calls.push(getTileInfo(tileURL))
    }

    return q.all(calls).then(function(data){
      return data
    })
}

function processMetadata(rawMetadata){
  //process the results of the promise queue
  var productInfo = rawMetadata[0]
  var productXML = rawMetadata[1]
  var essentialMetadata = parseMetadataXML(productXML)
  essentialMetadata.tiles = []
  // for (var i=2; i < rawMetadata.length; i++){
  //   //iterate over all tiles
  //   _tile = parseTileMetadata(rawMetadata[i], essentialMetadata)
  //   console.log(_tile)
  //   // essentialMetadata.tiles.push(_tile)
  // }
  saveMetadataToES(essentialMetadata)
}

function getProductInfo(pathToInfo){
  // request and download the product information
  return rp(pathToInfo)
}

function getProductMetadata(pathToMetadataXML){
  //request and download the xml file containing the metadata for the product
  return rp(pathToMetadataXML)
}

function getTileInfo(pathToTileInfo){
  //request and download the metadata for the individual tile
  return rp(pathToTileInfo)
}

function parseMetadataXML(xml){
  //parse the xml into json and extract the required keys
  var metaJSON = JSON.parse(xmlParser.toJson(xml))
  var keylist = [
    'SPACECRAFT_NAME',
    'PRODUCT_STOP_TIME',
    'Cloud_Coverage_Assessment',
    'PROCESSING_LEVEL',
    'PRODUCT_TYPE',
    'PROCESSING_BASELINE',
    'SENSING_ORBIT_NUMBER',
    'SENSING_ORBIT_DIRECTION',
    'PRODUCT_FORMAT'
  ]
  var valuelist = _.map(keylist, function(key){
    var v = getValueByKey(metaJSON, key)
    return v
  })

  var essentialMetadata = _.object(keylist, valuelist)

  //name keys explicityl
  essentialMetadata.product_cloud_coverage_assessment = +getValueByKey(metaJSON, 'Cloud_Coverage_Assessment')
  essentialMetadata.sensing_orbit_number = +getValueByKey(metaJSON, 'SENSING_ORBIT_NUMBER')

  essentialMetadata.tiles = getTileNames(metaJSON)

  essentialMetadata.bands = getBandInfo(metaJSON)
  essentialMetadata.spacecraft_name = "sentinel3"

  return essentialMetadata
}

function getTileNames(metaJSON){
  //get a list of tile names from the json metadata
  var tiles = {}
  var granualName = getValueByKey(metaJSON, "granuleIdentifier")
  var namePcs = granualName.split("_")
  var mgs = namePcs[namePcs.length - 2]
  tiles[mgs] = granualName
  return tiles
}

function getBandInfo(metaJSON){
  //create a list of the bands present in the product

  var band_list = getValueByKey(metaJSON, 'Band_List')
  if (band_list){
    //do stuff with the band list here
  }else{
    //alternate name
    band_list = getValueByKey(metaJSON, "Spectral_Information")
    for (var i=0; i < band_list.length; i++){
      band_list[i].physicalBand.replace("B")
      if (band_list[i].physicalBand.length == 1){
        band_list[i].physicalBand = pad(band_list[i].physicalBand, 1)
      }
    }
  } //end SpectralInfo Block
  return band_list
}

function parseTileMetadata(rawTileMetadata, productMeta){
  //parse each tile in the scene
  var tile = JSON.parse(rawTileMetadata)
  tile.date = tile.timestamp
  tile.thumbnail = S3_URI  + "/" + tile.path + "/preview.jp2"
  var keys = Object.keys(tile)
  // links = ['{2}/{0}/{1}.jp2'.format(meta['path'], b, s3_url) for b in bands]
  // console.log(productMeta)
  var links = []
  var bands = productMeta.bands
  for (var i=0; i < bands.length; i++){
    var _band = bands[i].physicalBand
    var _link = S3_URI + "/" + tile.path + "/" + _band + ".jp2"
    links.push(_link)
  }
  tile.download_links = links
  tile.original_tile_meta = S3_URI + "/" + tile.path + "/tileInfo.json"
  return tile
}

function logError(err){
  throw err
}

function doMetadataUpdate(meta, client){
  es.saveRecords(client, [meta])
  .then(function(d){
    console.log(d)
  })
}

function saveMetadataToES(meta){
  if (!esClient){
    console.log("doing connection")
    es.connect().then((client) =>{
      console.log("did connection")
      doMetadataUpdate(meta, client)
    })
    .catch(function(err){
      throw err
    })
  }else{
    doMetadataUpdate(meta, client, callback)
  }
}



// lib functions
function getValueByKey(object, key) {
  var result;
  _.some(object, function matchKey(value, $key) {
    if ($key === key) {
      result = value;
      return true;
    } else if (_.isObject(value)) {
      return _.some(value, matchKey);
    }
  });
  return result;
}

_.object = function(list, values) {
  if (list == null) return {};
  var result = {};
  for (var i = 0, l = list.length; i < l; i++) {
    if (values) {
      result[list[i]] = values[i];
    } else {
      result[list[i][0]] = list[i][1];
    }
  }
  return result;
};


// exports.handler = handler
var eventJSON = JSON.parse(fs.readFileSync('./test/data/event_message.json', 'utf8'));
handler(eventJSON)
