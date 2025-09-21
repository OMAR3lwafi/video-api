import { AppError } from './AppError';

export class ProcessingError extends AppError {
  constructor(message: string = 'Processing failed', correlationId?: string, details?: any) {
    super(message, 422, true, correlationId, details);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', correlationId?: string) {
    super(message, 408, true, correlationId);
  }
}

export class FileSizeError extends AppError {
  constructor(message: string = 'File size exceeds limit', correlationId?: string, details?: any) {
    super(message, 413, true, correlationId, details);
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(format: string, correlationId?: string) {
    super(`Unsupported format: ${format}`, 415, true, correlationId);
  }
}
