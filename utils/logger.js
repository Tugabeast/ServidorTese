const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'silly',
    format: format.json(),
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log', level: 'silly' }),
    ],
});

module.exports = { logger };


//miguel@gmail.com 