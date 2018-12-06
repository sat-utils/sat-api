const through2 = require('through2')
const highland = require('highland')
const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
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

function streamSink(stream) {
  const transform = through2.obj({ objectMode: true },
    (data, encoding, next) => {
      if (data) {
        next(null, `${data.links[0].href}\n`)
      } else {
        next(null, null)
      }
    })
    stream.pipe(transform)
    .pipe(process.stdout)
}

async function traverse(url, stream, count, root, next) {
  count += 1
  try {
    let response
    if (isUrl(url)) {
      response = await limitedRequest(url)
    } else {
      response = await limitedRead(url)
    }
    const cat = JSON.parse(response)
    stream.write(cat)
    const { links } = cat
    links.forEach(async (link) => {
      const { rel, href } = link
      if (rel === 'child' || rel === 'item') {
        count -= 1
        if (path.isAbsolute(href)) {
          traverse(href, stream, count)
        } else {
          traverse(`${path.dirname(url)}/${link.href}`, stream, count)
        }
      }
    })
    if (count === 0 && !root) {
      stream.push(null)
    }
  } catch (err) {
    console.log(err)
  }
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
    this.items.push(chunk)
    callback()
  }
  _read() {
    const item = this.items.pop()
    this.items.push(item)
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
  let count = 0
  traverse(url, duplexStream, count, true)
}
processCatalog('../tests/integration/data/catalog.json')

