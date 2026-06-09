export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class FileProcessingError extends AppError {
  constructor(message: string, public rowIndex?: number, public column?: string) {
    super(message, 'FILE_PROCESSING_ERROR', 422);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}