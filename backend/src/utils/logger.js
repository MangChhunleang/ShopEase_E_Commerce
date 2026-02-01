/**
 * Winston Logger Configuration
 * Provides structured logging with file rotation and different log levels
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (more readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Configure transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: isProduction ? 'info' : 'debug'
  })
);

// File transports (rotate daily, keep 14 days)
if (isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
      maxSize: '20m',
      format: logFormat
    })
  );

  // Combined logs (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: logFormat
    })
  );

  // Access logs (info and above)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxFiles: '30d',
      maxSize: '20m',
      format: logFormat
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: logFormat,
  transports,
  exitOnError: false
});

// Create a stream object for Morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Helper methods for common patterns
logger.logRequest = (method, url, statusCode, duration) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level](`${method} ${url} ${statusCode} - ${duration}ms`);
};

logger.logAuth = (action, email, success, details = '') => {
  logger.info(`AUTH ${action}: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`, { details });
};

logger.logOrder = (action, orderNumber, status, amount = null) => {
  const meta = { orderNumber, status };
  if (amount !== null) meta.amount = amount;
  logger.info(`ORDER ${action}`, meta);
};

logger.logPayment = (action, orderNumber, method, status, details = {}) => {
  logger.info(`PAYMENT ${action}: ${orderNumber}`, { method, status, ...details });
};

logger.logDatabase = (action, details = {}) => {
  logger.debug(`DATABASE ${action}`, details);
};

// Export the logger
export default logger;
