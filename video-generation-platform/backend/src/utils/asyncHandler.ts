import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrapper function to handle async route handlers and automatically catch errors
 * This eliminates the need for try-catch blocks in every async route handler
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
