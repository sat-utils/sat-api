const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')
const MemoryStream = require('memorystream')

const limiter = new Bottleneck({
  maxConcurrent: 1000
})
const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

async function ingest(url, backend, recursive = true, collectionsOnly = false) {
  let count = 0
  async function traverse(urlPath, stream, root) {
    count += 1
    try {
      let response
      if (isUrl(url)) {
        response = await limitedRequest(urlPath)
        count -= 1
      } else {
        response = await limitedRead(urlPath)
        count -= 1
      }
      const item = JSON.parse(response)
      if (item) {
        const written = stream.write(item)
        if (recursive) {
          if (written && item) {
            // eslint-disable-next-line
            traverseLinks(item, urlPath, stream, root)
          } else {
            stream.once('drain', () => {
              // eslint-disable-next-line
              traverseLinks(item, urlPath, stream, root)
            })
          }
        }
      }
      if ((count === 0 && !root) || (count === 0 && !recursive)) {
        stream.push(null)
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
      stream.push(null)
    }
  }

  const duplexStream = new MemoryStream(null, {
    readable: true,
    writable: true,
    objectMode: true
  })

  await backend.prepare('collections')
  await backend.prepare('items')
  const { toEs, esStream } = await backend.stream()
  const promise = new Promise((resolve, reject) => {
    pump(
      duplexStream,
      toEs,
      esStream,
      (error) => {
        if (error) {
          console.log('Error streaming: ', error)
          reject(error)
        } else {
          console.log('Ingest complete')
          resolve(true)
        }
      }
    )
  })
  traverse(url, duplexStream, true, recursive)
  return promise
}

module.exports = { ingest }
