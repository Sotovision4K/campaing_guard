import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import type { QueryResult } from 'pg';

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

function buildCapturingPino() {
  const stream = new StringStream();
  const logger = pino(
    { level: 'trace', base: { service: 'test' } },
    stream as unknown as pino.DestinationStream
  );
  return { logger, stream };
}

describe('instrumented query (db/index.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logs success shape on SELECT: event=db_query, status=success, operation=SELECT, rowCount, durationMs>=0', async () => {
    const { logger, stream } = buildCapturingPino();
    const poolStub = {
      query: vi.fn(async () => {
        return { rows: [{ id: 1 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } as unknown as QueryResult;
      }),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    const result = await db.query<{ id: number }>('SELECT id FROM users WHERE id = $1', [1]);

    expect(result.rowCount).toBe(1);
    const lines = stream.lines();
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const rec = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(rec.event).toBe('db_query');
    expect(rec.status).toBe('success');
    expect(rec.operation).toBe('SELECT');
    expect(rec.table).toBe('users');
    expect(rec.rowCount).toBe(1);
    expect(typeof rec.durationMs).toBe('number');
    expect(rec.durationMs as number).toBeGreaterThanOrEqual(0);
    expect(rec.sqlPreview).toBe('SELECT id FROM users WHERE id = $1');
  });

  it('logs failure shape and re-throws DBQueryError', async () => {
    const { logger, stream } = buildCapturingPino();
    const pgError = Object.assign(new Error('syntax error'), { code: '42601' });
    const poolStub = {
      query: vi.fn(async () => {
        throw pgError;
      }),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    const errors = await import('../../middleware/errors.js');
    const DBQueryError = errors.DBQueryError;
    let caught: unknown;
    try {
      await db.query('SELECT * FROM nope');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DBQueryError);

    const lines = stream.lines();
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const rec = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(rec.event).toBe('db_query');
    expect(rec.status).toBe('failure');
    expect(rec.operation).toBe('SELECT');
    expect(rec.table).toBe('nope');
    expect(typeof rec.durationMs).toBe('number');
    const errObj = rec.error as { code?: string; message?: string };
    expect(errObj.code).toBe('42601');
    expect(errObj.message).toBe('syntax error');
  });

  it('re-throws DBConnectionError when pg error code indicates connection failure', async () => {
    const { logger } = buildCapturingPino();
    const connError = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
    const poolStub = {
      query: vi.fn(async () => {
        throw connError;
      }),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    const errors = await import('../../middleware/errors.js');
    const DBConnectionError = errors.DBConnectionError;
    let caught: unknown;
    try {
      await db.query('SELECT 1');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DBConnectionError);
  });

  it('parses INSERT/UPDATE/DELETE operations and table names correctly', async () => {
    const { logger, stream } = buildCapturingPino();
    const poolStub = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as unknown as QueryResult)),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    await db.query('INSERT INTO orders (x) VALUES ($1)', [1]);
    await db.query('UPDATE users SET name=$1', ['a']);
    await db.query('DELETE FROM sessions WHERE id=$1', ['s']);

    const lines = stream.lines();
    const recs = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(recs[0].operation).toBe('INSERT');
    expect(recs[0].table).toBe('orders');
    expect(recs[1].operation).toBe('UPDATE');
    expect(recs[1].table).toBe('users');
    expect(recs[2].operation).toBe('DELETE');
    expect(recs[2].table).toBe('sessions');
  });

  it('tolerates leading whitespace in SQL', async () => {
    const { logger, stream } = buildCapturingPino();
    const poolStub = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as unknown as QueryResult)),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    await db.query('   \n  SELECT * FROM things');

    const rec = JSON.parse(stream.lines()[0]) as Record<string, unknown>;
    expect(rec.operation).toBe('SELECT');
    expect(rec.table).toBe('things');
  });

  it('tolerates subqueries in SELECT projection', async () => {
    const { logger, stream } = buildCapturingPino();
    const poolStub = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as unknown as QueryResult)),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    await db.query('SELECT (SELECT id FROM inner_t) AS x FROM outer_t WHERE id = $1', [1]);

    const rec = JSON.parse(stream.lines()[0]) as Record<string, unknown>;
    expect(rec.operation).toBe('SELECT');
    expect(rec.table).toBe('outer_t');
  });

  it('tolerates CREATE TABLE / BEGIN / COMMIT / EXPLAIN as OTHER with no table', async () => {
    const { logger, stream } = buildCapturingPino();
    const poolStub = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as unknown as QueryResult)),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    await db.query('CREATE TABLE IF NOT EXISTS x (id int)');
    await db.query('BEGIN');
    await db.query('COMMIT');
    await db.query('EXPLAIN ANALYZE SELECT * FROM y');

    const recs = stream.lines().map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(recs[0].operation).toBe('OTHER');
    expect(recs[0].table).toBeUndefined();
    expect(recs[1].operation).toBe('OTHER');
    expect(recs[1].table).toBeUndefined();
    expect(recs[2].operation).toBe('OTHER');
    expect(recs[2].table).toBeUndefined();
    expect(recs[3].operation).toBe('OTHER');
    expect(recs[3].table).toBeUndefined();
  });

  it('captures initDatabase db_init event on success', async () => {
    const { logger, stream } = buildCapturingPino();
    const clientStub = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as unknown as QueryResult)),
      release: vi.fn(),
    };
    const poolStub = {
      connect: vi.fn(async () => clientStub),
      on: vi.fn(),
    };
    vi.doMock('pg', () => ({
      Pool: vi.fn(() => poolStub),
      default: { Pool: vi.fn(() => poolStub) },
    }));
    vi.doMock('../../logger/index.js', () => ({ logger }));

    const db = await import('../index.js');
    await db.initDatabase();

    const recs = stream.lines().map((l) => JSON.parse(l) as Record<string, unknown>);
    const initRec = recs.find((r) => r.event === 'db_init');
    expect(initRec).toBeDefined();
    expect(initRec?.status).toBe('success');
    expect(typeof initRec?.durationMs).toBe('number');
  });
});
