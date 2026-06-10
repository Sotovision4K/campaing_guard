export class ApiError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network error', cause?: unknown) {
    super(message, 'NETWORK_ERROR', cause);
  }
}

export class LLMError extends ApiError {
  public readonly retryable: boolean;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, options.code ?? 'LLM_ERROR', options.cause);
    this.retryable = options.retryable ?? true;
  }
}

export class DBError extends ApiError {
  constructor(message = 'Storage error', cause?: unknown) {
    super(message, 'DB_ERROR', cause);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', cause?: unknown) {
    super(message, 'NOT_FOUND', cause);
  }
}

export class FileProcessingError extends ApiError {
  constructor(message = 'File processing error', cause?: unknown) {
    super(message, 'FILE_PROCESSING_ERROR', cause);
  }
}

export class ConfigurationError extends ApiError {
  constructor(message = 'Configuration error', cause?: unknown) {
    super(message, 'CONFIGURATION_ERROR', cause);
  }
}

export class UnknownApiError extends ApiError {
  constructor(message = 'Unexpected error', cause?: unknown) {
    super(message, 'UNKNOWN_ERROR', cause);
  }
}

const REGISTRY: Record<string, new (message: string) => ApiError> = {
  NETWORK_ERROR: NetworkError,
  DB_ERROR: DBError,
  DB_CONNECTION_ERROR: DBError,
  DB_QUERY_ERROR: DBError,
  VALIDATION_ERROR: ValidationError,
  NOT_FOUND: NotFoundError,
  FILE_PROCESSING_ERROR: FileProcessingError,
  CONFIGURATION_ERROR: ConfigurationError,
};

export interface ApiErrorPayload {
  code: string;
  message: string;
  retryable?: boolean;
}

export function fromApiError(payload: ApiErrorPayload): ApiError {
  if (payload.code.startsWith('LLM_')) {
    return new LLMError(payload.message, {
      code: payload.code,
      retryable: payload.retryable ?? true,
    });
  }
  const Cls = REGISTRY[payload.code];
  if (Cls) {
    return new Cls(payload.message);
  }
  return new UnknownApiError(payload.message);
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function isLLMError(e: unknown): e is LLMError {
  return e instanceof LLMError;
}

export function isDBError(e: unknown): e is DBError {
  return e instanceof DBError;
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError;
}
