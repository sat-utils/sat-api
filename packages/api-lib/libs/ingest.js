const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')
const { Duplex } = require('stream')

const completed = 'completed'
const limiter = new Bottleneck({
  maxConcurrent: 1000
})
const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

class ItemStream extends Duplex {
  constructor() {
    super({
      readableObjectMode: true,
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
    // eslint-disable-next-line
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

async function ingest(url, backend, recursive = true, collectionsOnly = false) {
  let count = 0
  // eslint-disable-next-line
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
        if (recursive) {
          if (written && item) {
            // eslint-disable-next-line
            traverseLinks(item, url, stream, root)
          } else {
            stream.once('drain', () => {
              // eslint-disable-next-line
              traverseLinks(item, url, stream, root)
            })
          }
        }
      }
      if ((count === 0 && !root) || (count === 0 && !recursive)) {
        stream.write('completed')
        return 'Completed'
      }
    } catch (error) {
      count -= 1
      console.log(error)
    }
  }

  function traverseLinks(item, parentUrl, stream, root) {
    const { links } = item
    let hasChildren = false
    links.forEach(async (link) => {
      const { rel, href } = link
      if (rel === 'child' || rel === 'item') {
        hasChildren = true
        if (path.isAbsolute(href)) {
          traverse(href, stream)
        } else {
          traverse(`${path.dirname(parentUrl)}/${link.href}`, stream)
        }
      }
    })
    if (!hasChildren && root) {
      stream.write(completed)
    }
  }

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
    }
  )
  traverse(url, duplexStream, true, recursive)
}

module.exports = { ingest }
