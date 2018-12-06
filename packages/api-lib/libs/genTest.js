const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const through2 = require('through2')
const fs = require('fs')
const { Duplex } = require('stream');
process.env.ES_HOST = 'http://192.168.99.100:4571'
const backend = require('./es')

const limiter = new Bottleneck({
  maxConcurrent: 50,
  minTime: 10
})
const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

let count = 0
async function traverse(url, stream, root) {
  count += 1
  try {
    let response
    if (isUrl(url)) {
      response = await limitedRequest(url)
      count -= 1
    } else {
      response = await limitedRead(url)
      count -= 1
    }
    const item = JSON.parse(response)
    if (item) {
      const written = stream.write(item)
      if (written && item) {
        traverseLinks(item, url, stream)
      } else {
        stream.once('drain', () => {
          traverseLinks(item, url, stream)
        })
      }
    }
    if (count === 0 && !root) {
      stream.write('completed')
    }
  } catch (err) {
    console.log(err)
  }
}

function traverseLinks(item, url, stream) {
  const { links } = item
  links.forEach(async (link) => {
    const { rel, href } = link
    if (rel === 'child' || rel === 'item') {
      if (path.isAbsolute(href)) {
        traverse(href, stream)
      } else {
        traverse(`${path.dirname(url)}/${link.href}`, stream)
      }
    }
  })
}
class ItemStream extends Duplex {
  constructor(options) {
    super({
      readableObjectMode : true,
      writableObjectMode: true
    })
    this.items = []
  }
  _write(chunk, encoding, callback) {
    console.log('wrote ', chunk.id)
    this.items.push(chunk)
    this.push()
    callback()
  }
  _read() {
    this.items.some((item, index, _items) => {
      if (item === 'completed') {
        this.push(null)
      } else {
      console.log('Read ', item.id)
        const pause = this.push(item)
        _items.splice(index, 1)
        return !pause
      }
    })
  }
}

async function processCatalog(url) {
  const duplexStream = new ItemStream()
  traverse(url, duplexStream, true)
  await backend.prepare('collections')
  await backend.prepare('items')
  const { toEs, esStream } = await backend.stream()
  //duplexStream.pipe(toEs).pipe(esStream)
  pump(
    duplexStream,
    toEs,
    esStream,
    (err) => {
      if (err) {
        console.log('Error streaming: ', err)
      } else {
        console.log('Ingest complete')
      }
    })
}
processCatalog('../tests/integration/data/catalog.json')
//processCatalog('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/227/72/catalog.json')

