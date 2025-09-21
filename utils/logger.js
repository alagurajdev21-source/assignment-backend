const { createLogger, transports, format } = require('winston');

const logger = createLogger({
  format: format.combine(format.timestamp(), format.simple()),
  transports: [new transports.Console(), new transports.File({ filename: 'server.log' })]
});

logger.stream = { write: msg => logger.info(msg) };

module.exports = logger;
