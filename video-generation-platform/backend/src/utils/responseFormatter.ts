import { Response } from 'express';
import { ApiResponse, ApiError, PaginatedResponse } from '../types/api';

/**
 * Standardized success response formatter
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    timestamp: new Date().toISOString(),
    correlationId: res.locals.correlationId,
  };

  res.status(statusCode).json(response);
};

/**
 * Standardized error response formatter
 */
export const sendError = (
  res: Response,
  error: string,
  message: string,
  statusCode: number = 500,
  details?: any
): void => {
  const response: ApiError = {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    correlationId: res.locals.correlationId,
    details,
  };

  res.status(statusCode).json(response);
};

/**
 * Standardized paginated response formatter
 */
export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): void => {
  const totalPages = Math.ceil(total / limit);
  
  const paginatedResponse: PaginatedResponse<T> = {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    data: paginatedResponse,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
    correlationId: res.locals.correlationId,
  };

  res.status(200).json(response);
};

/**
 * Send created resource response
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): void => {
  sendSuccess(res, data, message, 201);
};

/**
 * Send no content response
 */
export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};

/**
 * Send accepted response (for async operations)
 */
export const sendAccepted = <T>(
  res: Response,
  data?: T,
  message: string = 'Request accepted for processing'
): void => {
  sendSuccess(res, data, message, 202);
};
