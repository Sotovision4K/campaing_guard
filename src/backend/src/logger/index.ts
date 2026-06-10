import pino, { type Logger, type LoggerOptions } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');

const baseOptions: LoggerOptions = {
  level,
  base: {
    service: 'profasee-backend',
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (!isProduction) {
  baseOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  };
}

export const logger: Logger = pino(baseOptions);

export default logger;
