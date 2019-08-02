const test = require('ava')
const sinon = require('sinon')
const MemoryStream = require('memorystream')
const proxquire = require('proxyquire')
const fs = require('fs')
const {
  ingest, ingestItem, getS3ParamsFromUrl, getS3Object
} = require('../libs/ingest')
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

test('getS3ParamsFromUrl parses s3 url correctly', async (t) => {
  let url = 's3://bucket-name/this/is/the/key'
  let result = getS3ParamsFromUrl(url)
  t.is(result.Bucket, 'bucket-name')
  t.is(result.Key, 'this/is/the/key')

  url = 's3://bucket-name/simplekey'
  result = getS3ParamsFromUrl(url)
  t.is(result.Bucket, 'bucket-name')
  t.is(result.Key, 'simplekey')

  url = 's3://landsat-pds/c1/L8/040/036/LC08_L1TP_040036_20190216_20190216_01_RT'
  result = getS3ParamsFromUrl(url)
  t.is(result.Bucket, 'landsat-pds')
  t.is(result.Key, 'c1/L8/040/036/LC08_L1TP_040036_20190216_20190216_01_RT')
})

test('getS3ParamsFromUrl throws exception on invalid s3 url', async (t) => {
  const badUrls = ['asdf', 's3://bucket-name/', 's3://bucket-name',
    's3:///key', 's3:///', 's3://']

  badUrls.forEach((url) => {
    const error = t.throws(() => getS3ParamsFromUrl(url))
    t.truthy(error.message.includes('cannot parse bucket/key'))
  })
})

test('getS3Object rejects promise on invalid s3 url', async (t) => {
  const badUrls = ['asdf', 's3://bucket-name/', 's3://bucket-name',
    's3:///key', 's3:///', 's3://']

  badUrls.forEach(async (url) => {
    // note throwsAsync appears to require upgrade to Ava version
    // const error = await t.throwsAsync(promise)

    const promise = getS3Object(url)
    const error = await t.throws(promise)
    t.truthy(error.message.includes('cannot parse bucket/key'))
  })
})
