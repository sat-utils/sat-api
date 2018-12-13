const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')
const MemoryStream = require('memorystream')
const { Readable } = require('readable-stream')
const uuid = require('uuid/v4')
const logger = require('./logger')

const limiter = new Bottleneck({
  maxConcurrent: 5000
})
const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

async function ingest(url, backend, recursive = true, collectionsOnly = false) {
  let count = 0
  async function traverse(urlPath, stream, root) {
    count += 1
    try {
      let response
      if (isUrl(urlPath)) {
        response = await limitedRequest(urlPath)
        count -= 1
      } else {
        response = await limitedRead(urlPath)
        count -= 1
      }
      const item = JSON.parse(response)
      const isCollection = item.hasOwnProperty('extent')
      //const isCatalog = (item.hasOwnProperty('stac_version') && !isCollection)
      if (item) {
        let written = true
        //if (!isCatalog) {
        written = stream.write(item)
        //}
        if (recursive && !(isCollection && collectionsOnly)) {
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
      logger.error(error)
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
  const ingestJobId = uuid()
  logger.info(`${ingestJobId} Started`)
  const promise = new Promise((resolve, reject) => {
    pump(
      duplexStream,
      toEs,
      esStream,
      (error) => {
        if (error) {
          logger.error(error)
          reject(error)
        } else {
          logger.info(`${ingestJobId} Completed`)
          resolve(true)
        }
      }
    )
  })
  traverse(url, duplexStream, true, recursive)
  return promise
}

async function ingestItem(item, backend) {
  const readable = new Readable({ objectMode: true })
  await backend.prepare('collections')
  await backend.prepare('items')
  const { toEs, esStream } = await backend.stream()
  const ingestJobId = uuid()
  logger.info(`${ingestJobId} for ${item.id} Started`)
  const promise = new Promise((resolve, reject) => {
    pump(
      readable,
      toEs,
      esStream,
      (error) => {
        if (error) {
          logger.error(error)
          reject(error)
        } else {
          logger.info(`${ingestJobId} for ${item.id} Completed`)
          resolve(true)
        }
      }
    )
  })
  readable.push(item)
  readable.push(null)
  return promise
}
module.exports = { ingest, ingestItem }
