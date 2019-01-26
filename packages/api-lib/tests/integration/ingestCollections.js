process.env.ES_HOST = `http://${process.env.DOCKER_NAME}:4571`
const ingest = require('../../libs/ingest').ingest
const backend = require('../../libs/es')

async function doIngest() {
  await ingest('../fixtures/stac/catalog.json', backend, true, true)
  console.log('Collections done')
}
doIngest()
