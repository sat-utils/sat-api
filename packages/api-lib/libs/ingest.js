const fs = require('fs')
const path = require('path')
const highland = require('highland')

// this should be passed in as a backend parameter
const backend = require('./es')

function readFile(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}


// iterator through every node in a Catalog tree
function* readCatalog(filename) {
  console.log(`Catalog: ${filename.toString()}`)

  const cat = readFile(filename.toString())
  yield cat
  for (let index = 0; index < cat.links.length; index += 1) {
    const link = cat.links[index]
    if (link.rel === 'child' || link.rel === 'item') {
      if (path.isAbsolute(link.href)) {
        yield* readCatalog(link.href)
      } else {
        yield* readCatalog(path.join(path.dirname(filename.toString()), link.href))
      }
    }
  }
}


async function ingest(url) {
  const catStream = highland(readCatalog(url))

  // prepare backend
  await backend.prepare('collections')
  await backend.prepare('items')

  await backend.stream(catStream)
}


module.exports = ingest
