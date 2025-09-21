/**
 * Logger utility - Re-exports logger from monitoring config
 * This provides a consistent import path for logger across the application
 */

export { logger } from '../config/monitoring';

/**
 * Additional logging utilities
 */
export const logRequest = (method: string, url: string, statusCode: number, responseTime: number) => {
  const { logger } = require('../config/monitoring');
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime,
    timestamp: new Date().toISOString()
  });
};

export const logResponse = (method: string, url: string, statusCode: number, responseTime: number) => {
  const { logger } = require('../config/monitoring');
  logger.info('HTTP Response', {
    method,
    url,
    statusCode,
    responseTime,
    timestamp: new Date().toISOString()
  });
};

export const logError = (error: Error, context?: Record<string, any>) => {
  const { logger } = require('../config/monitoring');
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context,
    timestamp: new Date().toISOString()
  });
};