const test = require('ava')
const sinon = require('sinon')
const MemoryStream = require('memorystream')
const ingest = require('../libs/ingest').ingest
const catalog = require('./fixtures/stac/catalog.json')
const collection = require('./fixtures/stac/collection.json')
const firstItem = require('./fixtures/stac/LC80100102015050LGN00.json')
const secondItem = require('./fixtures/stac/LC80100102015082LGN00.json')

const setup = () => {
  const dupOptions = {
    readable: true,
    writable: true,
    objectMode: true
  }
  const writeOptions = {
    writable: true,
    readable: false,
    objectMode: true
  }
  const toEs = new MemoryStream(null, dupOptions)
  const esStream = new MemoryStream(null, writeOptions)
  const backend = {
    stream: () => ({ toEs, esStream }),
    prepare: sinon.stub().resolves(true)
  }
  return {
    toEs,
    esStream,
    backend
  }
}

test('Ingest traverses the entire STAC tree', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/catalog.json', backend)
  t.deepEqual(esStream.queue[0], catalog)
  t.deepEqual(esStream.queue[1], collection)
  t.deepEqual(esStream.queue[2], firstItem)
  t.deepEqual(esStream.queue[3], secondItem)
})
