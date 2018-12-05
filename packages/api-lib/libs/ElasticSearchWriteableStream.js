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
    } catch(err) {
      next(err)
    }
  }

  async _writev(chunks, next) {
    const record = chunks
    .map(chunk => chunk.chunk)
    .reduce((arr, obj) => {
      /**
       * Each entry to the bulk API comprises an instruction (like 'index'
       * or 'delete') and some data:
       */
      
      arr.push({ index: { } })
      arr.push(obj)
      return arr
    }, [])

    /**
     * Push the array of actions to ES and indicate that we are ready
     * for more data. Be sure to propagate any errors:
     */

    try {
      await this.client.bulk({
        index: record.index,
        type: record.type,
        body: record.body
      })
      next()
    } catch(err) {
      next(err)
    }
  }
}

module.exports = ElasticSearchWritableStream
