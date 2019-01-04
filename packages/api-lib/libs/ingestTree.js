const request = require('request-promise-native')
const Bottleneck = require('bottleneck')
const util = require('util')
const path = require('path')
const fs = require('fs')
const isUrl = require('is-url')

const limiter = new Bottleneck({
  maxConcurrent: 10
})

const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

async function fetchChildren(node, basePath) {
  const self = node.links.find((link) => (link.rel === 'self'))
  const links = node.links.filter((link) => (link.rel === 'child' || link.rel === 'item'))
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
  const responses = await Promise.all(linkPromises)
  const children = responses.map((response) => (JSON.parse(response)))
  return children
}

// eslint-disable-next-line
async function visit(start, visited, stack, basePath) {
  console.log(start.id)
  stack.push(start)
  visited[start.id] = true
  if (stack.length) {
    const node = stack.pop()
    const children = await fetchChildren(node, basePath)
    // eslint-disable-next-line
    for (const child of children) {
      if (!visited[child.id]) {
        // eslint-disable-next-line
        await visit(child, visited, stack, basePath)
      }
    }
  } else {
    return Promise.resolve(true)
  }
}

async function ingest(url) {
  const visited = {}
  const stack = []
  if (isUrl(url)) {
    const rootResponse = await limitedRequest(url)
    const root = JSON.parse(rootResponse)
    await visit(root, visited, stack)
  } else {
    const rootResponse = await limitedRead(url)
    const root = JSON.parse(rootResponse)
    await visit(root, visited, stack, url)
  }
}

module.exports = { ingest }
