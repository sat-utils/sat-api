const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')
const { Duplex } = require('stream');
process.env.ES_HOST = 'http://192.168.99.100:4571'
const backend = require('./es')

const read = util.promisify(fs.readFile)
let count = 0
async function traverse(url, stream, root) {
  count += 1
  try {
    let response
    if (isUrl(url)) {
      response = await request(url)
      count -= 1
    } else {
      response = await read(url)
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
    count -= 1
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
    console.log('pushed ', chunk.id)
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
  await backend.prepare('collections')
  await backend.prepare('items')
  const { toEs, esStream } = await backend.stream()
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
  traverse(url, duplexStream, true)
}
//processCatalog('../tests/integration/data/catalog.json')
processCatalog('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/227/72/catalog.json')
//LC08_L1TP_227072_20181110_20181127_01_T1

