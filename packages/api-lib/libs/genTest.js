const through2 = require('through2')
const highland = require('highland')
const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')
const isUrl = require('is-url')
const util = require('util')
const fs = require('fs')

const limiter = new Bottleneck({
  maxConcurrent: 50,
  minTime: 10
})
const limitedRequest = limiter.wrap(request)
const limitedRead = limiter.wrap(util.promisify(fs.readFile))

function streamSink(stream) {
  const transform = through2.obj({ objectMode: true },
    (data, encoding, next) => {
      if (data) {
        next(null, `${data.links[0].href}\n`)
      } else {
        next()
      }
    })
  pump(stream, transform, process.stdout)
}

async function traverse(url, push, count, root) {
  count += 1
  try {
    let response
    if (isUrl(url)) {
      response = await limitedRequest(url)
    } else {
      response = await limitedRead(url)
    }
    const cat = JSON.parse(response)
    push(null, cat)
    const { links } = cat
    links.forEach(async (link) => {
      const { rel, href } = link
      if (rel === 'child' || rel === 'item') {
        count -= 1
        if (path.isAbsolute(href)) {
          traverse(href, push, count)
        } else {
          traverse(`${path.dirname(url)}/${link.href}`, push, count)
        }
      }
    })
    if (count === 0 && !root) {
      push(null)
    }
  } catch (err) {
    console.log(err)
  }
}

function processCatalog(url) {
  let count = 0
  const catStream = highland((push) => {
    traverse(url, push, count, true)
  })
  streamSink(catStream)
}

//processCatalog('https://landsat-stac.s3.amazonaws.com/catalog.json')
processCatalog('https://landsat-stac.s3.amazonaws.com/landsat-8-l1/227/catalog.json')
//processCatalog('../tests/integration/data/catalog.json')

