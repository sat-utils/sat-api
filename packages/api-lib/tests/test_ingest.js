const test = require('ava')
const sinon = require('sinon')
const MemoryStream = require('memorystream')
const proxquire = require('proxyquire')
const fs = require('fs')
const { ingest, ingestItem } = require('../libs/ingest')
const firstItem = require('./fixtures/stac/LC80100102015050LGN00.json')

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
  // Catalog is filtered by real toEs transform stream but is left in here.
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

test('ingest traverses the entire STAC tree', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/catalog.json', backend)

  const itemIds = [
    'landsat-8-l1',
    'collection2',
    'collection2_item',
    'LC80100102015050LGN00',
    'LC80100102015082LGN00'
  ]
  const queudIds = esStream.queue.map((queued) => queued.id)
  const hasItems = itemIds.map((itemId) => (queudIds.includes(itemId)))
  t.falsy(hasItems.includes(false))
})

test('ingest does not recurse', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/catalog.json', backend, false)
  t.is(esStream.queue.length, 1)
})

test('ingest consumes item with no children and closes stream', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/collectionNoChildren.json', backend)
  t.is(esStream.queue.length, 1)
})

test('ingest stops at collections when collectionsOnly is true', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/catalog.json', backend, true, true)
  const itemIds = [
    'LC80100102015050LGN00',
    'LC80100102015082LGN00'
  ]
  const hasItems = esStream.queue.map((queued) => (itemIds.includes(queued.id)))
  t.falsy(hasItems.includes(true))
})

test('ingest logs request error and continues', async (t) => {
  const error = sinon.spy()
  const stubFsRead = sinon.stub(fs, 'readFile')
  stubFsRead.callThrough()
  const errorMessage = 'errorMessage'
  stubFsRead.withArgs('./fixtures/stac/LC80100102015050LGN00.json')
    .throws(new Error(errorMessage))
  const proxyIngest = proxquire('../libs/ingest', {
    './logger': {
      error,
      info: () => {}
    },
    fs: stubFsRead
  })
  const { esStream, backend } = setup()
  await proxyIngest.ingest('./fixtures/stac/catalog.json', backend)
  t.is(error.firstCall.args[0], errorMessage,
    'Logs error via Winston transport')
  t.is(esStream.queue.length, 6, 'Skips errored request and continues')
})

test('ingestItem passes item through transform stream', async (t) => {
  const { esStream, backend } = setup()
  await ingestItem(firstItem, backend)
  t.deepEqual(esStream.queue[0], firstItem)
})
