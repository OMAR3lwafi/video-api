import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validation middleware factory that validates request data against Zod schemas
 */
export const validate = (schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate request parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(ValidationError.fromZodError(error, req.correlationId));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Body validation middleware
 */
export const validateBody = (schema: ZodSchema) => {
  return validate({ body: schema });
};

/**
 * Params validation middleware
 */
export const validateParams = (schema: ZodSchema) => {
  return validate({ params: schema });
};

/**
 * Query validation middleware
 */
export const validateQuery = (schema: ZodSchema) => {
  return validate({ query: schema });
};
