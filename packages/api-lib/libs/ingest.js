const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')
const { Duplex } = require('stream');
const backend = require('./es')
const pumpPromise = util.promisify(pump)

const limiter = new Bottleneck({
  maxConcurrent: 5000
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
      return 'Completed'
    }
  } catch (error) {
    count -= 1
    console.log(error)
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
      writableObjectMode: true,
      highWaterMark: 100
    })
    this.items = []
  }
  _write(chunk, encoding, callback) {
    console.log('Pushed ', chunk.id)
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

async function ingest(url, recursive = true, collectionsOnly = false) {
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

module.exports = { ingest }
