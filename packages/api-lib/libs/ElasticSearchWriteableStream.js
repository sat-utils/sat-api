const stream = require('stream')
const logger = console //require('./logger')

class ElasticSearchWritableStream extends stream.Writable {
  constructor(config, options) {
    super(options)
    this.config = config

    this.client = this.config.client
  }

  _destroy() {
    return this.client.close()
  }

  // Allows the flexibility to batch write to multiple indexes.
  transformRecords(chunks) {
    const operations = chunks.reduce((bulkOperations, chunk) => {
      const operation = {}
      const { chunk: record } = chunk
      operation[record.action] = {
        _index: record.index,
        _type: record.type,
        _id: record.id
      }
      if (record.parent) {
        operation[record.action]._parent = record.parent
      }

      bulkOperations.push(operation)
      if (record.action !== 'delete') {
        bulkOperations.push(record.body)
      }
      return bulkOperations
    }, [])
    return operations
  }
  // Write individual records with update/upsert
  async _write(record, enc, next) {
    try {
      const { index, id, body } = record
      await this.client.update({
        index,
        type: 'doc',
        id,
        body
      })
      logger.debug(`Wrote document ${id}`)
      next()
    } catch (err) {
      logger.error(err)
      next()
    }
  }

  // Batch write records, use highWaterMark to set batch size.
  async _writev(records, next) {
    const body = this.transformRecords(records)
    try {
      const result = await this.client.bulk({ body })
      const { errors, items } = result
      if (errors) {
        logger.error(items)
      } else {
        logger.debug(`Wrote batch of documents size ${body.length / 2}`)
      }
      next()
    } catch (err) {
      logger.error(err)
      next()
    }
  }
}

module.exports = ElasticSearchWritableStream
