import { Request, Response, NextFunction } from 'express';
import { getOrCreateCorrelationId } from '../utils/correlationId';
import { logRequest, logResponse } from '../utils/logger';

/**
 * Request logging middleware with correlation ID support
 */
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate or extract correlation ID
  const correlationId = getOrCreateCorrelationId(req.headers);
  
  // Attach correlation ID to request and response
  req.correlationId = correlationId;
  res.locals.correlationId = correlationId;
  
  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Record start time
  const startTime = Date.now();
  req.startTime = startTime;
  
  // Log incoming request
  logRequest(req.method, req.originalUrl, correlationId, {
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  
  res.end = function(this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
    const responseTime = Date.now() - startTime;
    
    // Log response
    logResponse(
      req.method,
      req.originalUrl,
      res.statusCode,
      responseTime,
      correlationId,
      {
        contentLength: res.get('Content-Length'),
        contentType: res.get('Content-Type'),
      }
    );

    // Call original end method
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding as any);
    }
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
};
