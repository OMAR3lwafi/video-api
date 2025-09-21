import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../config/monitoring';
import { SecurityLogger } from '../services/SecurityLogger';
import { SecuritySeverity } from '../types/auth';

const securityLogger = new SecurityLogger();

/**
 * General rate limiting middleware
 */
export const rateLimiterMiddleware = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
  },

  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Custom key generator (can be used to rate limit by user ID instead of IP)
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip || 'unknown'}`;
  },

  // Custom handler for when limit is exceeded
  handler: async (req, res) => {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    logger.warn('Rate limit exceeded', {
      ip: ipAddress,
      userAgent,
      url: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      userId: req.user?.id
    });

    // Log security event
    await securityLogger.logRateLimitExceeded(
      ipAddress,
      userAgent,
      req.originalUrl,
      {
        method: req.method,
        correlationId: req.correlationId,
        userId: req.user?.id,
        rateLimitType: 'general'
      }
    );

    res.status(429).json({
      error: 'TooManyRequests',
      message: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  },

  // Skip successful requests
  skipSuccessfulRequests: false,

  // Skip failed requests
  skipFailedRequests: false,
});

/**
 * Strict rate limiting for sensitive endpoints (auth, password reset, etc.)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  
  message: {
    error: 'TooManyRequests',
    message: 'Too many attempts, please try again later',
    retryAfter: 900, // 15 minutes
  },

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    // For auth endpoints, use IP + email if provided
    const email = req.body?.email;
    const ip = req.ip || 'unknown';
    return email ? `auth:${ip}:${email}` : `auth:${ip}`;
  },

  handler: async (req, res) => {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    logger.warn('Strict rate limit exceeded', {
      ip: ipAddress,
      userAgent,
      url: req.originalUrl,
      method: req.method,
      correlationId: req.correlationId,
      email: req.body?.email
    });

    // Log security event with higher severity
    await securityLogger.logRateLimitExceeded(
      ipAddress,
      userAgent,
      req.originalUrl,
      {
        method: req.method,
        correlationId: req.correlationId,
        email: req.body?.email,
        rateLimitType: 'strict',
        severity: 'high'
      }
    );

    res.status(429).json({
      error: 'TooManyRequests',
      message: 'Too many attempts, please try again later',
      retryAfter: 900,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  },
});

/**
 * Rate limiter for file upload endpoints
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 upload requests per hour
  
  message: {
    error: 'TooManyUploads',
    message: 'Too many upload requests, please try again later',
    retryAfter: 3600, // 1 hour
  },

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    // Use user ID for authenticated uploads, IP for anonymous
    if (req.user?.id) {
      return `upload:user:${req.user.id}`;
    }
    return `upload:ip:${req.ip || 'unknown'}`;
  },

  // Only count requests that actually upload files
  skip: (req) => {
    return !req.is('multipart/form-data');
  },

  handler: async (req, res) => {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    await securityLogger.logRateLimitExceeded(
      ipAddress,
      userAgent,
      req.originalUrl,
      {
        method: req.method,
        correlationId: req.correlationId,
        userId: req.user?.id,
        rateLimitType: 'upload'
      }
    );

    res.status(429).json({
      error: 'TooManyUploads',
      message: 'Too many upload requests, please try again later',
      retryAfter: 3600,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  }
});

/**
 * Rate limiter for status check endpoints
 */
export const statusRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  
  message: {
    error: 'TooManyRequests',
    message: 'Too many status check requests from this IP, please try again after a minute',
    retryAfter: 60
  },
  
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user?.id) {
      return `status:user:${req.user.id}`;
    }
    return `status:ip:${req.ip || 'unknown'}`;
  },

  handler: async (req, res) => {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    await securityLogger.logRateLimitExceeded(
      ipAddress,
      userAgent,
      req.originalUrl,
      {
        method: req.method,
        correlationId: req.correlationId,
        userId: req.user?.id,
        rateLimitType: 'status'
      }
    );

    res.status(429).json({
      error: 'TooManyRequests',
      message: 'Too many status check requests, please try again after a minute',
      retryAfter: 60,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  }
});

/**
 * API rate limiter for different user tiers
 */
export const createTieredRateLimiter = (limits: { [key: string]: { windowMs: number; max: number } }) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // Default 15 minutes
    max: 100, // Default limit
    
    keyGenerator: (req) => {
      const userRole = req.user?.role || 'guest';
      if (req.user?.id) {
        return `tiered:${userRole}:${req.user.id}`;
      }
      return `tiered:guest:${req.ip || 'unknown'}`;
    },

    handler: async (req, res) => {
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userRole = req.user?.role || 'guest';
      const limit = limits[userRole]?.max || limits.guest?.max || 10;
      const windowMs = limits[userRole]?.windowMs || limits.guest?.windowMs || 15 * 60 * 1000;
      
      await securityLogger.logRateLimitExceeded(
        ipAddress,
        userAgent,
        req.originalUrl,
        {
          method: req.method,
          correlationId: req.correlationId,
          userId: req.user?.id,
          userRole,
          rateLimitType: 'tiered',
          limit,
          windowMs
        }
      );

      res.status(429).json({
        error: 'TooManyRequests',
        message: `Rate limit exceeded for ${userRole} tier`,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      });
    },

    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Brute force protection for login attempts
 */
export const bruteForceProtection = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 failed attempts per hour
  
  keyGenerator: (req) => {
    const email = req.body?.email;
    const ip = req.ip || 'unknown';
    return `brute:${ip}:${email || 'no-email'}`;
  },

  // Only count failed login attempts
  skipSuccessfulRequests: true,
  skipFailedRequests: false,

  handler: async (req, res) => {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const email = req.body?.email;
    
    logger.error('Brute force attack detected', {
      ip: ipAddress,
      userAgent,
      email,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString()
    });

    await securityLogger.logSuspiciousActivity(
      'Brute force attack detected - multiple failed login attempts',
      ipAddress,
      userAgent,
      SecuritySeverity.CRITICAL,
      {
        email,
        correlationId: req.correlationId,
        attackType: 'brute_force_login'
      }
    );

    res.status(429).json({
      error: 'TooManyFailedAttempts',
      message: 'Too many failed login attempts. Account temporarily locked.',
      retryAfter: 3600, // 1 hour
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    });
  },

  standardHeaders: true,
  legacyHeaders: false
});
