const test = require('ava')
const sinon = require('sinon')
const MemoryStream = require('memorystream')
const proxquire = require('proxyquire')
const fs = require('fs')
const { ingest, ingestItem } = require('../libs/ingest')
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
  t.deepEqual(esStream.queue[0], catalog)
  t.deepEqual(esStream.queue[1], collection)
  t.deepEqual(esStream.queue[2], firstItem)
  t.deepEqual(esStream.queue[3], secondItem)
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

test('ingest only consumes collections', async (t) => {
  const { esStream, backend } = setup()
  await ingest('./fixtures/stac/catalog.json', backend, true, true)
  t.deepEqual(esStream.queue[1], collection)
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
  t.is(error.firstCall.args[0].message, errorMessage,
    'Logs error via Winston transport')
  t.is(esStream.queue.length, 3, 'Skips errored request and continues')
})

test('ingestItem passes item through transform stream', async (t) => {
  const { esStream, backend } = setup()
  await ingestItem(firstItem, backend)
  t.deepEqual(esStream.queue[0], firstItem)
})
