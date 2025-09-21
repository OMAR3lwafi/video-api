import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique correlation ID for request tracking
 */
export const generateCorrelationId = (): string => {
  return uuidv4();
};

/**
 * Extracts correlation ID from request headers or generates a new one
 */
export const getOrCreateCorrelationId = (headers: Record<string, string | string[] | undefined>): string => {
  const existingId = headers['x-correlation-id'] || headers['X-Correlation-ID'];
  
  if (typeof existingId === 'string' && existingId.length > 0) {
    return existingId;
  }
  
  return generateCorrelationId();
};
