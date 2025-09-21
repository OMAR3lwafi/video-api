import helmet from 'helmet';
import { config } from '../config';

/**
 * Enhanced security middleware configuration using Helmet
 */
export const securityMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for some dev tools
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.supabase.co", "wss://realtime.supabase.co"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
    reportOnly: !config.isProduction, // Only enforce in production
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for compatibility

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { 
    policy: config.isProduction ? 'same-origin' : 'same-origin-allow-popups' 
  },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { 
    policy: config.isProduction ? 'same-origin' : 'cross-origin' 
  },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },

  // Hide Powered-By header
  hidePoweredBy: true,

  // HTTP Strict Transport Security (HSTS)
  hsts: config.isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,

  // IE No Open
  ieNoOpen: true,

  // No Sniff (X-Content-Type-Options)
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,

  // Referrer Policy
  referrerPolicy: { 
    policy: ['no-referrer-when-downgrade', 'strict-origin-when-cross-origin']
  },

  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true,
});

/**
 * Additional security headers middleware
 */
export const additionalSecurityHeaders = (req: any, res: any, next: any) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent information disclosure
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Cache control for sensitive endpoints
  if (req.path.includes('/auth') || req.path.includes('/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // Feature Policy / Permissions Policy
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=(self)',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'picture-in-picture=(self)'
  ].join(', '));
  
  // Clear Site Data on logout
  if (req.path === '/api/v1/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
  }
  
  next();
};

/**
 * Security middleware for file uploads
 */
export const fileUploadSecurityHeaders = (req: any, res: any, next: any) => {
  // Prevent execution of uploaded files
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'attachment');
  
  // Additional headers for file responses
  if (req.path.includes('/upload') || req.path.includes('/file')) {
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  }
  
  next();
};

/**
 * API security headers
 */
export const apiSecurityHeaders = (req: any, res: any, next: any) => {
  // JSON responses should not be cached
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent JSONP hijacking
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // API versioning header
  res.setHeader('API-Version', '1.0.0');
  
  // Rate limit headers (will be overridden by rate limiter if present)
  if (!res.getHeader('X-RateLimit-Limit')) {
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', '100');
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + 900);
  }
  
  next();
};
