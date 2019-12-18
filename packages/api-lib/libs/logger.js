const winston = require('winston')
const WinstonCloudWatch = require('winston-cloudwatch')


const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
//    new winston.transports.Console({
//      format: winston.format.simple(),
//      level: process.env.LOG_LEVEL || 'debug'
//    }),
    new WinstonCloudWatch({
      logGroupName: 'testing',
      logStreamName: 'first'
    })
  ]
})

logger.stream = {
  write: (info) => {
    logger.info(info)
  }
}

module.exports = logger
