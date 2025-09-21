import cors from 'cors';
import { config } from '../config';
import { logger } from '../config/monitoring';
import { SecurityLogger } from '../services/SecurityLogger';
import { SecuritySeverity } from '../types/auth';

const securityLogger = new SecurityLogger();

/**
 * Enhanced CORS middleware with security logging and dynamic origin validation
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Parse allowed origins from config
    const allowedOrigins = config.security.corsOrigin.split(',').map(o => o.trim());
    
    // Allow all origins in development (if configured)
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Exact match
      if (allowedOrigin === origin) {
        return true;
      }
      
      // Wildcard subdomain match (e.g., *.example.com)
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.slice(2);
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      
      // Protocol-agnostic match
      if (allowedOrigin.startsWith('//')) {
        return origin.includes(allowedOrigin.slice(2));
      }
      
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log blocked CORS request
      logger.warn('CORS request blocked', {
        origin,
        allowedOrigins,
        timestamp: new Date().toISOString()
      });

      // Log security event for blocked CORS
      securityLogger.logSuspiciousActivity(
        `CORS request blocked from unauthorized origin: ${origin}`,
        'unknown', // IP not available in CORS preflight
        'unknown', // User agent not available
        SecuritySeverity.MEDIUM,
        {
          origin,
          allowedOrigins,
          corsBlocked: true
        }
      ).catch(err => logger.error('Failed to log CORS security event:', err));

      const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
      callback(error, false);
    }
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

  // Allowed headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Correlation-ID',
    'X-Request-ID',
    'Cache-Control',
    'Pragma'
  ],

  // Headers exposed to the client
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
    'X-Correlation-ID',
    'API-Version'
  ],

  // Preflight cache duration (24 hours)
  maxAge: 86400,

  // Handle preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204
});

/**
 * Strict CORS middleware for sensitive endpoints
 */
export const strictCorsMiddleware = cors({
  origin: (origin, callback) => {
    // No origin allowed for strict endpoints (must be same-origin)
    if (!origin) {
      return callback(null, true);
    }

    // Only allow specific trusted origins for sensitive endpoints
    const trustedOrigins = [
      'https://app.yourdomain.com',
      'https://admin.yourdomain.com'
    ];

    // In development, allow localhost
    if (!config.isProduction) {
      trustedOrigins.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }

    const isAllowed = trustedOrigins.includes(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('Strict CORS request blocked', {
        origin,
        trustedOrigins,
        timestamp: new Date().toISOString()
      });

      securityLogger.logSuspiciousActivity(
        `Strict CORS request blocked from unauthorized origin: ${origin}`,
        'unknown',
        'unknown',
        SecuritySeverity.HIGH,
        {
          origin,
          trustedOrigins,
          strictCorsBlocked: true,
          endpoint: 'sensitive'
        }
      ).catch(err => logger.error('Failed to log strict CORS security event:', err));

      const error = new Error(`Strict CORS policy violation: Origin ${origin} not allowed for sensitive endpoints`);
      callback(error, false);
    }
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID'
  ],
  exposedHeaders: [
    'X-Correlation-ID'
  ],
  maxAge: 3600, // 1 hour cache for strict CORS
  preflightContinue: false,
  optionsSuccessStatus: 204
});

/**
 * API-only CORS middleware (no credentials)
 */
export const apiCorsMiddleware = cors({
  origin: config.security.corsOrigin === '*' ? true : config.security.corsOrigin.split(',').map(o => o.trim()),
  credentials: false, // No credentials for API-only endpoints
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-API-Key',
    'X-Correlation-ID',
    'Accept'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'API-Version'
  ],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
});

/**
 * Development CORS middleware (permissive)
 */
export const devCorsMiddleware = cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: '*',
  exposedHeaders: '*',
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
});
