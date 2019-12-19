const request = require('request-promise-native')
const Bottleneck = require('bottleneck')
const util = require('util')
const path = require('path')
const fs = require('fs')
const isUrl = require('is-url')
const MemoryStream = require('memorystream')
const { Readable } = require('readable-stream')
const pump = require('pump')
const logger = console //require('./logger')

const limiter = new Bottleneck({
  maxConcurrent: 500
})

const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

function getSelfRef(node) {
  let ref
  const self = node.links.find((link) => (link.rel === 'self'))
  if (self && self.href) {
    ref = self.href
  }
  return ref
}

function getChildLinks(node) {
  const links =
    node.links.filter((link) => (link.rel === 'child' || link.rel === 'item'))
  return links
}

async function fetchChildren(node, links, basePath) {
  const selfHref = getSelfRef(node)
  const linkPromises = links.map((link) => {
    let urlPath
    let returnPromise
    if (!selfHref || !link.href) {
      return Promise.reject(new Error(`${node.id} has invalid links`))
    }
    if (path.isAbsolute(link.href)) {
      urlPath = link.href
    } else {
      // eslint-disable-next-line
      if (basePath) {
        urlPath = `${path.dirname(basePath)}/${link.href}`
      } else {
        urlPath = `${path.dirname(selfHref)}/${link.href}`
      }
    }
    if (isUrl(urlPath)) {
      returnPromise = limitedRequest(urlPath)
    } else {
      returnPromise = limitedRead(urlPath)
    }
    return returnPromise
  })
  let responses
  try {
    responses = await Promise.all(linkPromises.map((p) => p.catch((e) => e)))
  } catch (error) {
    logger.error(error)
  }
  const validResponses =
    responses.filter((response) => !(response instanceof Error))
  const failedResponses =
    responses.filter((response) => (response instanceof Error))
  failedResponses.forEach((failure) => {
    logger.error(failure.message)
  })
  const children = validResponses.map((response) => (JSON.parse(response)))
  return children
}

// Mutates stack and visited
async function visitChildren(node, stack, visited, basePath) {
  let children
  const nodeLinks = getChildLinks(node)
  try {
    children = await fetchChildren(node, nodeLinks, basePath)
  } catch (error) {
    logger.error(error)
  }
  if (children) {
    // eslint-disable-next-line
    for (const child of children) {
      const key = getSelfRef(child)
      const childLinks = getChildLinks(child)
      if (key) {
        if (!visited[key]) {
          stack.push(child)
          if (childLinks.length) {
            visited[key] = true
          }
        }
      } else {
        logger.error(`${node.id} has invalid self link`)
      }
    }
  }
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
    // Handles relative root link in file catalog.
    basePath = url
  }
  stack.push(root)
  const rootId = getSelfRef(root)
  visited[rootId] = true
  while (stack.length) {
    const node = stack.pop()
    const isCollection = node.hasOwnProperty('extent')
    const isItem = node.hasOwnProperty('geometry')
    if (!(isCollection || isItem)) {
      const selfRef = getSelfRef(node)
      logger.debug(`catalog ${selfRef}`)
    }
    stream.write(node)
    if (recursive && !(isCollection && collectionsOnly)) {
      try {
        // eslint-disable-next-line
        await visitChildren(node, stack, visited, basePath)
      } catch (error) {
        logger.error(error)
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
  logger.info(`Job Started for ${url}`)
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
          logger.info(`Job completed for ${url}`)
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
          logger.info(`Ingested item ${item.id}`)
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
