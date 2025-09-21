import { AppError } from './AppError';

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', correlationId?: string) {
    super(message, 401, true, correlationId);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', correlationId?: string) {
    super(message, 403, true, correlationId);
  }
}
