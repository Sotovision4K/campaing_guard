import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError, LLMError } from './errors.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      console.error(`[non-operational ${err.code}]`, err);
      if ((err as { cause?: unknown }).cause) {
        console.error('Cause:', (err as { cause?: unknown }).cause);
      }
    }
    const body: Record<string, unknown> = {
      code: err.code,
      message: err.message,
    };
    if (err instanceof LLMError) {
      body.retryable = err.retryable;
    }
    res.status(err.statusCode).json({ error: body });
    return;
  }

  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};