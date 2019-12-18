'use strict'

const satlib = require('@sat-utils/api-lib')
const logger = console


module.exports.handler = async function handler(event) {
  logger.info(`Ingest Event: ${JSON.stringify(event)}`)
  try {
    if (event.Records && (event.Records[0].EventSource === 'aws:sns')) {
      // event is SNS message of updated file on s3
      const message = JSON.parse(event.Records[0].Sns.Message)
      if (message.type && message.type === 'Feature') {
        // event is a STAC Item
        await satlib.ingest.ingestItem(message, satlib.es)
      } else {
        // updated s3
        const { Records: s3Records } = message
        const promises = s3Records.map((s3Record) => {
          const {
            s3: {
              bucket: { name: bucketName },
              object: { key }
            }
          } = s3Record
          const url = `https://${bucketName}.s3.amazonaws.com/${key}`
          logger.log(`Ingesting catalog file ${url}`)
          const recursive = false
          return satlib.ingest.ingest(url, satlib.es, recursive)
        })
        await Promise.all(promises)
      }
    } else if ((event.type && event.type === 'Feature') || (event.id && event.extent)) {
      // event is STAC Item or Collection JSON
      await satlib.ingest.ingestItem(event, satlib.es)
    } else if (event.url) {
      // event is URL to a catalog node
      const { url, recursive, collectionsOnly } = event
      const recurse = recursive === undefined ? true : recursive
      const collections = collectionsOnly === undefined ? false : collectionsOnly
      await satlib.ingest.ingest(url, satlib.es, recurse, collections)
    }
  } catch (error) {
    console.log(error)
  }
}

