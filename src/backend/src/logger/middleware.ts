import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { logContext, getContextualLogger, type LogContext } from './context.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  const ctx: LogContext = { requestId };

  logContext.enterWith(ctx);

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1_000_000;
    getContextualLogger().info(
      {
        event: 'http_request',
        method: req.method,
        url: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        durationMs,
      },
      'http_request'
    );
  });

  next();
};

export const errorLogger: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  getContextualLogger().error(
    {
      event: 'unhandled_error',
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    },
    'unhandled_error'
  );
  next(err);
};
