const fs = require('fs')
const request = require('sync-request')
const highland = require('highland')
const isUrl = require('is-url')
const path = require('path')


// this should be passed in as a backend parameter
const backend = require('./es')


function readFile(filename) {
  if (isUrl(filename)) {
    const data = JSON.parse(request('GET', filename).getBody('utf8'))
    return data
  }
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}


// iterator through every node in a Catalog tree
let nCat = 0
let nCol = 0
let nItem = 0
function* readCatalog(filename, root = false, recursive = true, collectionsOnly = false) {
  console.log(`Reading ${filename}`)
  const fname = filename.toString()
  const cat = readFile(fname)
  if (cat.hasOwnProperty('extent')) {
    // Collection
    nCol += 1
    yield cat
    if (collectionsOnly) {
      // stop recursing
      return true
    }
  } else if (cat.hasOwnProperty('geometry')) {
    // Item
    nItem += 1
    yield cat
  } else {
    // Catalog
    nCat += 1
  }
  let index = 0
  if (recursive) {
    for (index = 0; index < cat.links.length; index += 1) {
      const link = cat.links[index]
      if (link.rel === 'child' || link.rel === 'item') {
        if (path.isAbsolute(link.href)) {
          yield* readCatalog(link.href)
        } else {
          yield* readCatalog(`${path.dirname(fname)}/${link.href}`)
        }
      }
    }
  }
  if (root) {
    console.log(`Read ${nCat} catalogs, ingested ${nCol} collections and ${nItem} items.`)
  }
  return true
}


async function prepare() {
  await backend.prepare('collections')
  await backend.prepare('items')
}


async function ingest(url, recursive = true, collectionsOnly = false) {
  const catStream = highland(readCatalog(url, true, recursive, collectionsOnly))

  // prepare backend
  await prepare()

  await backend.stream(catStream)
}


module.exports = { ingest, prepare }
