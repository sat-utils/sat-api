process.env.ES_HOST = 'http://192.168.99.100:4571'
const ingest = require('../../libs/ingest').ingest

const ingestData = async () => {
  await ingest('./data/catalog.json')
}

try {
  ingestData()
  console.log('Done')
} catch (error) {
  console.log(error)
}

