import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { logger, logError } from '../utils/logger';
import { sendError } from '../utils/responseFormatter';

/**
 * Global error handling middleware
 * Must be the last middleware in the stack
 */
export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = req.correlationId;

  // Log the error
  logError(error, {
    correlationId,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Handle known application errors
  if (error instanceof AppError) {
    sendError(res, error.name, error.message, error.statusCode, error.details);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    sendError(
      res,
      'ValidationError',
      'Request validation failed',
      400,
      { validationErrors }
    );
    return;
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, 'SyntaxError', 'Invalid JSON in request body', 400);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    sendError(res, 'AuthenticationError', 'Invalid token', 401);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    sendError(res, 'AuthenticationError', 'Token expired', 401);
    return;
  }

  // Handle MongoDB/Database errors
  if (error.name === 'MongoError' || error.name === 'ValidationError') {
    sendError(res, 'DatabaseError', 'Database operation failed', 500);
    return;
  }

  // Handle multer errors (file upload)
  if (error.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;

    switch ((error as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        statusCode = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = error.message;
    }

    sendError(res, 'FileUploadError', message, statusCode);
    return;
  }

  // Handle rate limiting errors
  if (error.name === 'TooManyRequestsError') {
    sendError(res, 'RateLimitError', 'Too many requests', 429);
    return;
  }

  // Default to 500 server error for unknown errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  sendError(
    res,
    'InternalServerError',
    isDevelopment ? error.message : 'Internal server error',
    500,
    isDevelopment ? { stack: error.stack } : undefined
  );
};
