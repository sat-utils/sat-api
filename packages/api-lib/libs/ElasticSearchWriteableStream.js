const stream = require('stream')

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

  /**
   * When writing a single record, we use the index() method of
   * the ES API:
   */

  async _write(record, enc, next) {
    /**
     * Push the object to ES and indicate that we are ready for the next one.
     * Be sure to propagate any errors:
     */

    try {
      await this.client.index({
        index: record.index,
        type: record.type,
        body: record.body
      })
      next()
      return
    } catch (err) {
      next(err)
    }
  }

  async _writev(chunks, next) {
    const body = chunks.reduce((bulkOperations, chunk) => {
      const record = chunk.chunk
      const operation = {}
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

    try {
      await this.client.bulk({
        body
      })
      console.log('Wrote ', body.length)
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = ElasticSearchWritableStream
