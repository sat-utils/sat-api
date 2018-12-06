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
      console.log(record.body.doc.id)
      next()
      return
    } catch(err) {
      next(err)
    }
  }

  async _writev(chunks, next) {
    try {
      await this.client.bulk({
        body: chunks
      })
      next()
    } catch(err) {
      next(err)
    }
  }
}

module.exports = ElasticSearchWritableStream
