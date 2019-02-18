process.env.ES_HOST = `http://${process.env.DOCKER_NAME}:4571`
const ingest = require('../../libs/ingest').ingest
const backend = require('../../libs/es')

async function doIngest() {
  try {
    await ingest('../fixtures/stac/catalog.json', backend)
    console.log('Items done')
  } catch (error) {
    console.log(error.message)
  }
}
//ingest('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/catalog.json', backend)
doIngest()
