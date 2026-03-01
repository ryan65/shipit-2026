const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const path = require('path');

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
});

const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

function resolveLevel() {
  const idx = process.argv.indexOf('--logLevel');
  if (idx !== -1) {
    const val = process.argv[idx + 1];
    if (val && VALID_LEVELS.includes(val)) return val;
    console.error(`Invalid --logLevel "${val}". Valid levels: ${VALID_LEVELS.join(', ')}. Defaulting to info.`);
  }
  return 'info';
}

const logger = createLogger({
  level: resolveLevel(),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // All logs (debug, info, error) -> combined.log
    new transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log'),
    }),
    // Only error logs -> error.log
    new transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
    }),
    // Console output with color
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

module.exports = logger;
