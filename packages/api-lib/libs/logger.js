var winston = require('winston');

var logger = new (winston.Logger)({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new (winston.transports.Console)({'timestamp': true})
  ]
});

module.exports = logger;
