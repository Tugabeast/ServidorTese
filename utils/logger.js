const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'silly',
    // Adicionar timestamp ao formato JSON
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json()
    ),
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log', level: 'silly' }),
    ],
});

module.exports = { logger };