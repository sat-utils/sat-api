const winston = require('winston')


const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      level: process.env.LOG_LEVEL || 'debug'
    })
  ]
})


module.exports = logger
