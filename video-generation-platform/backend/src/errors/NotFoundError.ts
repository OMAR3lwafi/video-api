import { AppError } from './AppError';

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', correlationId?: string) {
    super(`${resource} not found`, 404, true, correlationId);
  }
}
