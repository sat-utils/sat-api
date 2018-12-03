const through2 = require('through2')
const highland = require('highland')
const pump = require('pump')
const request = require('request-promise-native')
const path = require('path')
const Bottleneck = require('bottleneck')

function streamSink(stream) {
  const transform = through2.obj({ objectMode: true }, (data, encoding, next) => {
    next(null, `${data.id}\n`)
  })
  pump(stream, transform, process.stdout)
}

async function traverse(url, limiter, push, next) {
  try {
    const wrapped = limiter.wrap(request)
    const response = await wrapped(url)
    const cat = JSON.parse(response)
    push(null, cat)
    const { links } = cat
    links.forEach(async (link) => {
      const { rel, href } = link
      if (rel === 'child' || rel === 'item') {
        if (path.isAbsolute(href)) {
          traverse(href, limiter, push, next)
        } else {
          traverse(`${path.dirname(url)}/${link.href}`, limiter, push, next)
        }
      }
    })
  } catch (err) {
    console.log(err)
  }
}
function processCatalog(url) {
  const limiter = new Bottleneck({
    maxConcurrent: 50,
    minTime: 10
  })
  const catStream = highland((push, next) => {
    traverse(url, limiter, push, next)
  })
  streamSink(catStream)
}

processCatalog('https://landsat-stac.s3.amazonaws.com/catalog.json')

