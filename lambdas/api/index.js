'use strict';

const zlib = require('zlib');
const Api = require('sat-api-lib');
const util = require('lambda-proxy-utils');
const get = require('lodash.get');
const es = require('../../lib/es');
let esClient;

function search(action, req, cb) {
  const s = new Api(req, esClient);
  const encoding = get(req, 'headers.Accept-Encoding', null);

  s[action](function (err, resp) {
    if (err) {
      console.log(err);
      const res = new util.Response({ cors: true, statusCode: 400 });
      return cb(null, res.send({ details: err.message }));
    }
    const res = new util.Response({ cors: true, statusCode: 200 });

    if (encoding && encoding.includes('gzip')) {
      zlib.gzip(JSON.stringify(resp), function(error, gzipped) {
        //if(error) context.fail(error);
        const response = {
          statusCode: 200,
          body: gzipped.toString('base64'),
          isBase64Encoded: true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip'
          }
        };
        return cb(error, response);
      });
    }
    else {
      return cb(null, res.send(resp));
    }
  });
}

function getAction(resource) {
  const path = resource.replace('/main', '');

  if (path) {
    return path.replace('/', '');
  }
  return 'simple';
}

/**
 * @api {get} / GET
 * @apiName /
 * @apiGroup search
 * @apiDescription Primary search functionality. Parameters listed are shared across satellites (Landsat-8 and Sentinel-2).
 * Satellite specific parameters can be searched on the in the same fashion (exact match).
 *
 * @apiParam {Number} limit=1 Limit of results to return.
 * @apiParam {Number} skip=0 Results to skip in return.
 * @apiParam {Number} page=1 Results page to view.
 * @apiParam {String} fields Comma separated list of fields to include in the query results. Ex: `?fields=scene_id,date,cloud_coverage`.
 * @apiParam {String} contains Comma separated lists of form `longitude,latitude`. Returns results if the point  is within the bounding box of an image. Ex `?contains=40.23,70.76`.
 * @apiParam {String} intersects Valid GeoJSON, returns results that touch any point of the geometry.
 * @apiParam {String} scene_id Performs exact search on sceneID field.
 * @apiParam {Number} cloud_from The lower limit for cloud_coverage field.
 * @apiParam {Number} cloud_to The upper limit for cloud_coverage field.
 *
 * @apiSuccess {Object} meta Metadata about the search endpoint.
 * @apiSuccess {Number} meta.found Total number of results returned from this query.
 * @apiSuccess {String} meta.name API name.
 * @apiSuccess {String} meta.license API license.
 * @apiSuccess {String} meta.website API endpoint.
 * @apiSuccess {Number} meta.page Results page being viewed.
 * @apiSuccess {Number} meta.limit Limit of results to return.
 * @apiSuccess {Object[]} results Query results.
 * @apiSuccess {String} results.scene_id Scene ID.
 * @apiSuccess {String} results.satellite_name Satellite name.
 * @apiSuccess {Number} results.cloud_coverage Cloud coverage.
 * @apiSuccess {String} results.date Date when image was taken.
 * @apiSuccess {String} results.thumbnail Thumbnail for the scene.
 * @apiSuccess {Object} results.data_geometry GeoJSON representing the scene outline.
 * @apiSuccessExample {json} Minimal Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "meta": {
 *     "found": 2257062,
 *     "name": "sat-api",
 *     "license": "CC0-1.0",
 *     "website": "https://api.developmentseed.org/satellites/",
 *     "page": 1,
 *     "limit": 1
 *   },
 *   "results": [
 *     {
 *       "scene_id": "LC81000202017030LGN00",
 *       "satellite_name": "landsat-8",
 *       "cloud_coverage": 19.53,
 *       "date": "2017-01-30",
 *       "thumbnail": "https://ad-thumbnails.s3.amazonaws.com/LC81000202017030LGN00.jpg",
 *       "data_geometry": {
 *         "crs": {
 *           "type": "name",
 *           "properties": {
 *             "name": "urn:ogc:def:crs:EPSG:8.9:4326"
 *           }
 *         },
 *         "type": "Polygon",
 *         "coordinates": [
 *           [
 *             [
 *               161.38522,
 *               57.878
 *             ],
 *             [
 *               158.27701,
 *               58.39804
 *             ],
 *             [
 *               157.37548,
 *               56.70892
 *             ],
 *             [
 *               160.35236,
 *               56.20273
 *             ],
 *             [
 *               161.38522,
 *               57.878
 *             ]
 *           ]
 *         ]
 *       }
 *     }
 *   ]
 * }
 * @apiSuccessExample {json} Full Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "meta": {
 *     "found": 2257062,
 *     "name": "sat-api",
 *     "license": "CC0-1.0",
 *     "website": "https://api.developmentseed.org/satellites/",
 *     "page": 1,
 *     "limit": 1
 *   },
 *   "results": [
 *     {
 *       "scene_id": "LC81000202017030LGN00",
 *       "satellite_name": "landsat-8",
 *       "cloud_coverage": 19.53,
 *       "date": "2017-01-30",
 *       "thumbnail": "https://ad-thumbnails.s3.amazonaws.com/LC81000202017030LGN00.jpg",
 *       "data_geometry": {
 *         "crs": {
 *           "type": "name",
 *           "properties": {
 *             "name": "urn:ogc:def:crs:EPSG:8.9:4326"
 *           }
 *         },
 *         "type": "Polygon",
 *         "coordinates": [
 *           [
 *             [
 *               161.38522,
 *               57.878
 *             ],
 *             [
 *               158.27701,
 *               58.39804
 *             ],
 *             [
 *               157.37548,
 *               56.70892
 *             ],
 *             [
 *               160.35236,
 *               56.20273
 *             ],
 *             [
 *               161.38522,
 *               57.878
 *             ]
 *           ]
 *         ]
 *       },
 *       "browseAvailable": "Y",
 *       "browseURL": "http://earthexplorer.usgs.gov/browse/landsat_8/2017/100/020/LC81000202017030LGN00.jpg",
 *       "sceneID": "LC81000202017030LGN00",
 *       "sensor": "OLI_TIRS",
 *       "acquisitionDate": "2017-01-30",
 *       "dateUpdated": "2017-01-29",
 *       "path": 100,
 *       "row": 20,
 *       "upperLeftCornerLatitude": 58.39804,
 *       "upperLeftCornerLongitude": 158.27701,
 *       "upperRightCornerLatitude": 57.878,
 *       "upperRightCornerLongitude": 161.38522,
 *       "lowerLeftCornerLatitude": 56.70892,
 *       "lowerLeftCornerLongitude": 157.37548,
 *       "lowerRightCornerLatitude": 56.20273,
 *       "lowerRightCornerLongitude": 160.35236,
 *       "sceneCenterLatitude": 57.30952,
 *       "sceneCenterLongitude": 159.3503,
 *       "cloudCover": 1,
 *       "cloudCoverFull": 19.53,
 *       "dayOrNight": "DAY",
 *       "sunElevation": 13.6553746,
 *       "sunAzimuth": 163.05483232,
 *       "receivingStation": "LGN",
 *       "sceneStartTime": "2017:030:00:26:23.6556890",
 *       "sceneStopTime": "2017:030:00:26:55.4256860",
 *       "imageQuality1": 9,
 *       "DATA_TYPE_L1": "L1T",
 *       "cartURL": "http://earthexplorer.usgs.gov/order/process?dataset_name=LANDSAT_8&ordered=LC81000202017030LGN00",
 *       "ROLL_ANGLE": -0.001,
 *       "GEOMETRIC_RMSE_MODEL_X": 10.185,
 *       "GEOMETRIC_RMSE_MODEL_Y": 11.822,
 *       "FULL_PARTIAL_SCENE": "FULL",
 *       "NADIR_OFFNADIR": "NADIR",
 *       "PROCESSING_SOFTWARE_VERSION": "LPGS_2.6.2",
 *       "CPF_NAME": "L8CPF20170101_20170331.02",
 *       "RLUT_FILE_NAME": "L8RLUT20150303_20431231v11.h5",
 *       "BPF_NAME_OLI": "LO8BPF20170130002250_20170130010416.01",
 *       "BPF_NAME_TIRS": "LT8BPF20170126095930_20170126100746.01",
 *       "GROUND_CONTROL_POINTS_MODEL": 178,
 *       "GROUND_CONTROL_POINTS_VERSION": 4,
 *       "DATE_L1_GENERATED": "2017-01-29 22:17:21",
 *       "TIRS_SSM_MODEL": "PRELIMINARY"
 *     }
 *   ]
 * }
 */
module.exports.handler = function (event, context, cb) {
  const method = event.httpMethod;
  const payload = { query: {}, headers: event.headers };
  const action = getAction(event.resource);

  if (method === 'POST' && event.body) {
    payload.query = JSON.parse(event.body);
  }
  else if (method === 'GET' && event.queryStringParameters) {
    payload.query = event.queryStringParameters;
  }

  if (!esClient) {
    es.connect().then((client) => {
      esClient = client;
      search(action, payload, cb);
    });
  }
  else {
    search(action, payload, cb);
  }
};
