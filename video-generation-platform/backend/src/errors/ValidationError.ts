import { AppError } from './AppError';
import { ZodError } from 'zod';

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', correlationId?: string, details?: any) {
    super(message, 400, true, correlationId, details);
  }

  static fromZodError(zodError: ZodError, correlationId?: string): ValidationError {
    const errors = zodError.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
      received: 'received' in error ? error.received : undefined,
    }));

    return new ValidationError(
      'Request validation failed',
      correlationId,
      { validationErrors: errors }
    );
  }

  static fromFieldError(field: string, message: string, correlationId?: string): ValidationError {
    return new ValidationError(
      `Validation failed for field: ${field}`,
      correlationId,
      { validationErrors: [{ field, message }] }
    );
  }
}
