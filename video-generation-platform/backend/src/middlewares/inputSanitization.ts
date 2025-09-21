import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import { logger } from '../config/monitoring';
import { SecurityLogger } from '../services/SecurityLogger';
import { SecuritySeverity } from '../types/auth';

const securityLogger = new SecurityLogger();

// Create a JSDOM window for DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * SQL injection patterns to detect and block
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /('|(\\')|(;)|(--)|(\s)|(\/\*)|(\*\/))/gi,
  /(UNION\s+(ALL\s+)?SELECT)/gi,
  /(SELECT\s+.*\s+FROM\s+)/gi,
  /(INSERT\s+INTO\s+.*\s+VALUES)/gi,
  /(UPDATE\s+.*\s+SET\s+)/gi,
  /(DELETE\s+FROM\s+)/gi,
  /(DROP\s+(TABLE|DATABASE|INDEX))/gi,
  /(\bxp_\w+)/gi,
  /(\bsp_\w+)/gi
];

/**
 * XSS patterns to detect and block
 */
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
  /<svg[^>]*>.*?<\/svg>/gi,
  /<math[^>]*>.*?<\/math>/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /@import/gi,
  /binding\s*:/gi
];

/**
 * NoSQL injection patterns
 */
const NOSQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$gte/gi,
  /\$lte/gi,
  /\$in/gi,
  /\$nin/gi,
  /\$regex/gi,
  /\$exists/gi,
  /\$type/gi,
  /\$mod/gi,
  /\$all/gi,
  /\$size/gi,
  /\$elemMatch/gi,
  /\$slice/gi
];

/**
 * Command injection patterns
 */
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]]/g,
  /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|nslookup|dig|curl|wget|nc|telnet|ssh|ftp|scp|rsync)\b/gi,
  /\b(rm|mv|cp|chmod|chown|kill|killall|sudo|su|passwd|mount|umount)\b/gi,
  /\b(echo|printf|read|exec|eval|source|bash|sh|zsh|csh|tcsh|fish)\b/gi,
  /(\||&&|;|`|\$\(|\$\{)/g
];

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e%5c/gi,
  /\.\.%2f/gi,
  /\.\.%5c/gi,
  /%252e%252e%252f/gi
];

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Normalize unicode
  sanitized = sanitized.normalize('NFKC');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}

/**
 * Sanitize HTML content
 */
function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Configure DOMPurify for strict sanitization
  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false,
    FORCE_BODY: false
  };

  return purify.sanitize(input, config);
}

/**
 * Detect SQL injection attempts
 */
function detectSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Detect XSS attempts
 */
function detectXss(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Detect NoSQL injection attempts
 */
function detectNoSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return NOSQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Detect command injection attempts
 */
function detectCommandInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return COMMAND_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Detect path traversal attempts
 */
function detectPathTraversal(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  return PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any, depth: number = 0): any {
  // Prevent deep recursion DoS
  if (depth > 10) {
    return {};
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const sanitizedKey = sanitizeString(key);
      
      // Skip potentially dangerous keys
      if (sanitizedKey.startsWith('__') || sanitizedKey.includes('prototype')) {
        continue;
      }
      
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    
    return sanitized;
  }

  return obj;
}

/**
 * Log security threat
 */
async function logSecurityThreat(
  req: Request,
  threatType: string,
  input: string,
  severity: SecuritySeverity = SecuritySeverity.HIGH
): Promise<void> {
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  logger.warn(`Security threat detected: ${threatType}`, {
    threatType,
    input: input.substring(0, 200), // Log first 200 chars only
    ip: ipAddress,
    userAgent,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    correlationId: req.correlationId
  });

  await securityLogger.logMaliciousRequest(
    ipAddress,
    userAgent,
    {
      threatType,
      input: input.substring(0, 200),
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    },
    threatType
  );
}

/**
 * Input sanitization middleware
 */
export const inputSanitization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    next(error);
  }
};

/**
 * SQL injection detection middleware
 */
export const sqlInjectionDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const checkInput = (input: any, path: string = ''): boolean => {
      if (typeof input === 'string') {
        if (detectSqlInjection(input)) {
          logSecurityThreat(req, 'SQL Injection', input, SecuritySeverity.CRITICAL);
          return true;
        }
      } else if (typeof input === 'object' && input !== null) {
        for (const [key, value] of Object.entries(input)) {
          if (checkInput(value, `${path}.${key}`)) {
            return true;
          }
        }
      }
      return false;
    };

    // Check all input sources
    const hasSqlInjection = 
      checkInput(req.body, 'body') ||
      checkInput(req.query, 'query') ||
      checkInput(req.params, 'params');

    if (hasSqlInjection) {
      res.status(400).json({
        error: 'SecurityViolation',
        message: 'Malicious input detected',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('SQL injection detection error:', error);
    next(error);
  }
};

/**
 * XSS detection middleware
 */
export const xssDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const checkInput = (input: any): boolean => {
      if (typeof input === 'string') {
        if (detectXss(input)) {
          logSecurityThreat(req, 'XSS Attack', input, SecuritySeverity.HIGH);
          return true;
        }
      } else if (typeof input === 'object' && input !== null) {
        for (const value of Object.values(input)) {
          if (checkInput(value)) {
            return true;
          }
        }
      }
      return false;
    };

    const hasXss = 
      checkInput(req.body) ||
      checkInput(req.query) ||
      checkInput(req.params);

    if (hasXss) {
      res.status(400).json({
        error: 'SecurityViolation',
        message: 'Cross-site scripting attempt detected',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('XSS detection error:', error);
    next(error);
  }
};

/**
 * Command injection detection middleware
 */
export const commandInjectionDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const checkInput = (input: any): boolean => {
      if (typeof input === 'string') {
        if (detectCommandInjection(input)) {
          logSecurityThreat(req, 'Command Injection', input, SecuritySeverity.CRITICAL);
          return true;
        }
      } else if (typeof input === 'object' && input !== null) {
        for (const value of Object.values(input)) {
          if (checkInput(value)) {
            return true;
          }
        }
      }
      return false;
    };

    const hasCommandInjection = 
      checkInput(req.body) ||
      checkInput(req.query) ||
      checkInput(req.params);

    if (hasCommandInjection) {
      res.status(400).json({
        error: 'SecurityViolation',
        message: 'Command injection attempt detected',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Command injection detection error:', error);
    next(error);
  }
};

/**
 * Path traversal detection middleware
 */
export const pathTraversalDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const checkInput = (input: any): boolean => {
      if (typeof input === 'string') {
        if (detectPathTraversal(input)) {
          logSecurityThreat(req, 'Path Traversal', input, SecuritySeverity.HIGH);
          return true;
        }
      } else if (typeof input === 'object' && input !== null) {
        for (const value of Object.values(input)) {
          if (checkInput(value)) {
            return true;
          }
        }
      }
      return false;
    };

    const hasPathTraversal = 
      checkInput(req.body) ||
      checkInput(req.query) ||
      checkInput(req.params);

    if (hasPathTraversal) {
      res.status(400).json({
        error: 'SecurityViolation',
        message: 'Path traversal attempt detected',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Path traversal detection error:', error);
    next(error);
  }
};

/**
 * Comprehensive security middleware that combines all protections
 */
export const comprehensiveSecurity = [
  inputSanitization,
  sqlInjectionDetection,
  xssDetection,
  commandInjectionDetection,
  pathTraversalDetection
];

// Export individual sanitization functions for use in services
export {
  sanitizeString,
  sanitizeHtml,
  sanitizeObject,
  detectSqlInjection,
  detectXss,
  detectNoSqlInjection,
  detectCommandInjection,
  detectPathTraversal
};