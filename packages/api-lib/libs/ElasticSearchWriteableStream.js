const stream = require('stream')
const logger = require('./logger')

class ElasticSearchWritableStream extends stream.Writable {
  constructor(config, options) {
    super(options)
    this.config = config

    /**
     * Create the ElasticSearch client:
     */
    this.client = this.config.client
  }

  _destroy() {
    return this.client.close()
  }

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
  /**
   * When writing a single record, we use the index() method of
   * the ES API:
   */

  async _write(record, enc, next) {
    try {
      await this.client.index({
        id: record.id,
        index: record.index,
        type: record.type,
        body: record.body.doc
      })
      logger.debug(record.body.doc.id)
      next()
    } catch (err) {
      next(err)
    }
  }

  async _writev(records, next) {
    const body = this.transformRecords(records)

    /**
     * Push the array of actions to ES and indicate that we are ready
     * for more data. Be sure to propagate any errors:
     */

    try {
      await this.client.bulk({ body })
      logger.debug('Wrote ', body.length / 2)
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = ElasticSearchWritableStream
