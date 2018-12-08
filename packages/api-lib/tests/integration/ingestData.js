process.env.ES_HOST = 'http://192.168.99.100:4571'
const ingest = require('../../libs/ingest').ingest
const backend = require('../../libs/es')
//const col = 'https://landsat-stac.s3.amazonaws.com/landsat-8-l1/226/88/catalog.json'

//ingest('../fixtures/stac/catalog.json', backend)
ingest('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/226/70/catalog.json', backend)
//ingest('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/226/catalog.json', backend)

