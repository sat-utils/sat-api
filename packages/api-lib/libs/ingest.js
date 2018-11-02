const fs = require('fs')
const path = require('path')
const highland = require('highland')

// this should be passed in as a backend parameter
const backend = require('./es')

function readFile(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}


let nCat = 0
let nCol = 0
let nItem = 0


// iterator through every node in a Catalog tree
function* readCatalog(filename, root = false) {
  const fname = filename.toString()
  const cat = readFile(fname)
  if (cat.hasOwnProperty('extent')) {
    nCol += 1
  } else if (cat.hasOwnProperty('geometry')) {
    nItem += 1
  } else {
    nCat += 1
  }
  yield cat
  let index = 0
  for (index = 0; index < cat.links.length; index += 1) {
    const link = cat.links[index]
    if (link.rel === 'child' || link.rel === 'item') {
      if (path.isAbsolute(link.href)) {
        yield* readCatalog(link.href)
      } else {
        yield* readCatalog(path.join(path.dirname(fname), link.href))
      }
    }
  }
  if (root) {
    console.log(`Read ${nCat} catalogs, ${nCol} collections, ${nItem} items.`)
  }
  return true
}


async function ingest(url) {
  const catStream = highland(readCatalog(url, true), (x) => {
    console.log(`highland func: ${x}`)
  })
  //console.log(`catStream ${JSON.stringify(catStream)}`)

  // prepare backend
  await backend.prepare('collections')
  await backend.prepare('items')

  await backend.stream(catStream)
}


module.exports = ingest
