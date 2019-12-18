const winston = require('winston')

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  transports: [
    new (winston.transports.Console)({ timestamp: true })
  ]
})

module.exports = logger
