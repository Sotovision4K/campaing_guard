import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from './errors.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};