const request = require('request-promise-native')
const Bottleneck = require('bottleneck')
const util = require('util')
const path = require('path')
const fs = require('fs')
const isUrl = require('is-url')
const MemoryStream = require('memorystream')
const { Readable } = require('readable-stream')
const pump = require('pump')
const uuid = require('uuid/v4')
const logger = require('./logger')

const limiter = new Bottleneck({
  maxConcurrent: 1000
})

const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

async function fetchChildren(node, basePath) {
  const self = node.links.find((link) => (link.rel === 'self'))
  const links =
    node.links.filter((link) => (link.rel === 'child' || link.rel === 'item'))
  const linkPromises = links.map((link) => {
    let urlPath
    let returnPromise
    if (path.isAbsolute(link.href)) {
      urlPath = link.href
    } else {
      // eslint-disable-next-line
      if (basePath) {
        urlPath = `${path.dirname(basePath)}/${link.href}`
      } else {
        urlPath = `${path.dirname(self.href)}/${link.href}`
      }
    }
    if (isUrl(urlPath)) {
      returnPromise = limitedRequest(urlPath)
    } else {
      returnPromise = limitedRead(urlPath)
    }
    return returnPromise
  })
  const responses = await Promise.all(linkPromises.map((p) => p.catch((e) => e)))
  const validResponses =
    responses.filter((response) => !(response instanceof Error))
  const failedResponses =
    responses.filter((response) => (response instanceof Error))
  failedResponses.forEach((failure) => {
    logger.error(failure)
  })
  const children = validResponses.map((response) => (JSON.parse(response)))
  return children
}

async function visit(url, stream, recursive, collectionsOnly) {
  const visited = {}
  const stack = []
  let root
  let basePath
  if (isUrl(url)) {
    const rootResponse = await limitedRequest(url)
    root = JSON.parse(rootResponse)
  } else {
    const rootResponse = await limitedRead(url)
    root = JSON.parse(rootResponse)
    basePath = url
  }
  stack.push(root)
  visited[root.id] = true
  while (stack.length) {
    const node = stack.pop()
    const isCollection = node.hasOwnProperty('extent')
    stream.write(node)
    if (recursive && !(isCollection && collectionsOnly)) {
      // eslint-disable-next-line
      const children = await fetchChildren(node, basePath)
      // eslint-disable-next-line
      for (const child of children) {
        if (!visited[child.id]) {
          // eslint-disable-next-line
          stack.push(child)
          visited[child.id] = true
        }
      }
    }
  }
  stream.push(null)
}

async function ingest(url, backend, recursive = true, collectionsOnly = false) {
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
  visit(url, duplexStream, recursive, collectionsOnly)
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
