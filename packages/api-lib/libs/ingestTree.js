const request = require('request-promise-native')
const Bottleneck = require('bottleneck')
const util = require('util')
const path = require('path')
const fs = require('fs')
const crawl = require('tree-crawl')

const limiter = new Bottleneck({
  maxConcurrent: 10
})

const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

async function fetchChildren(node, url) {
  const links = node.links.filter((link) => (link.rel === 'child' || link.rel === 'item'))
  const linkPromises = links.map((link) => {
    const absolutePath = `${path.dirname(url)}/${link.href}`
    console.log(absolutePath)
    return limitedRead(absolutePath)
  })
  const responses = await Promise.all(linkPromises)
  const children = responses.map((response) => (JSON.parse(response)))
  return children
}

async function visit(start, visited, stack, url) {
  console.log(start.id)
  stack.push(start)
  visited[start.id] = true
  if (stack.length) {
    const node = stack.pop()
    const children = await fetchChildren(node, url)
    for (const child of children) {
      if (!visited[child.id]) {
        await visit(child, visited, stack, url)
      }
    }
  } else {
    return Promise.resolve(true)
  }
}

async function ingest(url) {
  const visited = {}
  const stack = []
  const rootResponse = await limitedRead(url)
  const root = JSON.parse(rootResponse)
  const completed = await visit(root, visited, stack, url)
}

module.exports = { ingest }
