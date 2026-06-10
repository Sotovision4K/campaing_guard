import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import { Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import {
  runWithContext,
  getContextualLogger,
  logContext,
  getContext,
} from '../context.js';
import { requestLogger, errorLogger } from '../middleware.js';

class StringStream extends Writable {
  public chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    callback();
  }

  lines(): string[] {
    return this.chunks.join('').split('\n').filter((l) => l.length > 0);
  }
}

interface FakeReq {
  method: string;
  originalUrl: string;
  url: string;
  headers: Record<string, string | undefined>;
  requestId?: string;
}

interface FakeRes extends EventEmitter {
  statusCode: number;
  setHeader(name: string, value: string): void;
  headers: Record<string, string>;
}

function makeRes(): FakeRes {
  const emitter = new EventEmitter();
  const res = emitter as unknown as FakeRes;
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (name: string, value: string): void => {
    res.headers[name] = value;
  };
  return res;
}

describe('logger context (ALS)', () => {
  it('getContextualLogger inherits requestId from ALS when inside runWithContext', () => {
    let captured: Record<string, unknown> | undefined;

    runWithContext({ requestId: 'req-abc' }, () => {
      const child = getContextualLogger({ component: 'unit' });
      captured = child.bindings();
    });

    expect(captured).toBeDefined();
    expect(captured?.requestId).toBe('req-abc');
    expect(captured?.component).toBe('unit');
  });

  it('getContextualLogger does not see context outside runWithContext', () => {
    let bindings: Record<string, unknown> | undefined;
    runWithContext({ requestId: 'inside' }, () => {
      bindings = getContextualLogger().bindings();
    });
    expect(bindings?.requestId).toBe('inside');

    const outside = getContextualLogger().bindings();
    expect(outside.requestId).toBeUndefined();
  });

  it('getContext returns undefined outside of any context', () => {
    expect(logContext.getStore()).toBeUndefined();
  });

  it('respects log level - debug emitted at debug level, trace filtered out', () => {
    const debugStream = new StringStream();
    const debugLogger = pino(
      { level: 'debug' },
      debugStream as unknown as pino.DestinationStream
    );
    debugLogger.debug({ event: 'd' }, 'd');
    debugLogger.trace({ event: 't' }, 't');
    const events = debugStream
      .lines()
      .map((l) => JSON.parse(l) as { event?: string })
      .map((o) => o.event);
    expect(events).toContain('d');
    expect(events).not.toContain('t');
  });

  it('re-throws the original error in runWithContext when fn throws', () => {
    expect(() =>
      runWithContext({ requestId: 'x' }, () => {
        throw new Error('boom');
      })
    ).toThrow('boom');
  });

  it('isolates contexts across nested runs', () => {
    let counter = 0;
    runWithContext({ requestId: 'outer' }, () => {
      counter++;
      runWithContext({ requestId: 'inner' }, () => {
        counter++;
        expect(getContextualLogger().bindings().requestId).toBe('inner');
      });
      expect(getContextualLogger().bindings().requestId).toBe('outer');
      counter++;
    });
    expect(counter).toBe(3);
  });

  it('propagates ALS context through awaited async work', async () => {
    await runWithContext({ requestId: 'async-req' }, async () => {
      await Promise.resolve();
      expect(getContextualLogger().bindings().requestId).toBe('async-req');
      await new Promise((resolve) => setImmediate(resolve));
      expect(getContextualLogger().bindings().requestId).toBe('async-req');
    });
  });
});

describe('logger context binding semantics', () => {
  it('child logger merges bindings with ALS context, explicit bindings win', () => {
    let captured: Record<string, unknown> | undefined;
    runWithContext({ requestId: 'req-1', userId: 'u-1' }, () => {
      const child = getContextualLogger({ requestId: 'override' });
      captured = child.bindings();
    });
    expect(captured?.requestId).toBe('override');
    expect(captured?.userId).toBe('u-1');
  });
});

describe('requestLogger middleware', () => {
  beforeEach(() => {
    logContext.enterWith({});
  });

  it('generates a requestId, sets the response header, and ALS context is available to next()', () => {
    const req: FakeReq = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      url: '/api/v1/health',
      headers: {},
    };
    const res = makeRes();
    let seenInNext: string | undefined;

    requestLogger(req as never, res as never, () => {
      seenInNext = getContext()?.requestId;
    });

    expect(req.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(req.requestId);
    expect(seenInNext).toBe(req.requestId);
  });

  it('uses incoming x-request-id header when present and non-empty', () => {
    const req: FakeReq = {
      method: 'POST',
      originalUrl: '/api/v1/upload',
      url: '/api/v1/upload',
      headers: { 'x-request-id': 'client-supplied-123' },
    };
    const res = makeRes();
    requestLogger(req as never, res as never, () => {});

    expect(req.requestId).toBe('client-supplied-123');
    expect(res.headers['x-request-id']).toBe('client-supplied-123');
  });

  it('keeps ALS context available inside res.on(finish) callback', async () => {
    const req: FakeReq = {
      method: 'GET',
      originalUrl: '/x',
      url: '/x',
      headers: {},
    };
    const res = makeRes();
    requestLogger(req as never, res as never, () => {});

    await new Promise<void>((resolve) => {
      res.on('finish', () => {
        expect(getContext()?.requestId).toBe(req.requestId);
        resolve();
      });
      res.emit('finish');
    });
  });
});

describe('errorLogger middleware', () => {
  it('calls next(err) and does not swallow the error', () => {
    const err = new Error('kaboom');
    const next = (e?: unknown): void => {
      expect(e).toBe(err);
    };
    errorLogger(err, {} as never, {} as never, next);
  });
});
