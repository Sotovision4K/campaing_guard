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

export class LLMError extends AppError {
  retryable: boolean;

  constructor(
    message: string,
    options?: { cause?: unknown; retryable?: boolean; code?: string; statusCode?: number }
  ) {
    super(message, options?.code ?? 'LLM_ERROR', options?.statusCode ?? 502, true);
    this.retryable = options?.retryable ?? true;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message = 'LLM rate limit exceeded', options?: { cause?: unknown }) {
    super(message, { ...options, code: 'LLM_RATE_LIMIT', statusCode: 429 });
    this.retryable = true;
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message = 'LLM request timed out', options?: { cause?: unknown }) {
    super(message, { ...options, code: 'LLM_TIMEOUT', statusCode: 504 });
    this.retryable = true;
  }
}

export class LLMResponseParseError extends LLMError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { ...options, code: 'LLM_PARSE_ERROR', retryable: false });
  }
}

export class LLMConfigError extends LLMError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { ...options, code: 'LLM_CONFIG_ERROR', retryable: false });
  }
}

export class DBError extends AppError {
  query?: string;

  constructor(
    message: string,
    options?: { cause?: unknown; code?: string; query?: string }
  ) {
    super(message, options?.code ?? 'DB_ERROR', 500, true);
    this.query = options?.query;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class DBConnectionError extends DBError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { ...options, code: 'DB_CONNECTION_ERROR' });
    (this as { statusCode?: number }).statusCode = 503;
  }
}

export class DBQueryError extends DBError {
  constructor(message: string, options?: { cause?: unknown; query?: string }) {
    super(message, { ...options, code: 'DB_QUERY_ERROR' });
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 'CONFIGURATION_ERROR', 500, false);
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isOperationalError(err: unknown): err is AppError {
  return err instanceof AppError && err.isOperational;
}

export function isRetryable(err: unknown): boolean {
  return err instanceof LLMError && err.retryable === true;
}

export function isLLMError(err: unknown): err is LLMError {
  return err instanceof LLMError;
}

export function isDBError(err: unknown): err is DBError {
  return err instanceof DBError;
}


