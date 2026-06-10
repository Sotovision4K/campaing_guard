import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import { DBConnectionError, DBQueryError } from '../middleware/errors.js';
import { logger } from '../logger/index.js';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'profasee',
  user: process.env.DB_USER || 'profasee',
  password: process.env.DB_PASSWORD || 'profasee',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error(
    { event: 'db_pool_error', err: { name: err.name, message: err.message, stack: err.stack } },
    'db_pool_error'
  );
  throw new DBConnectionError('Database connection error', { cause: err });
});

type DBOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';

const cleanToken = (raw: string): string => raw.replace(/[(),;]/g, '');

function extractSelectTable(tokens: string[]): string | undefined {
  let depth = 0;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) continue;
    const upper = token.toUpperCase();
    for (const ch of token) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && upper === 'FROM') {
      const next = tokens[i + 1];
      if (next === undefined) return undefined;
      const cleaned = cleanToken(next);
      return cleaned.length > 0 ? cleaned : undefined;
    }
  }
  return undefined;
}

function parseOperationAndTable(
  text: string
): { operation: DBOperation; table: string | undefined } {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) {
    return { operation: 'OTHER', table: undefined };
  }
  const upper = trimmed.toUpperCase();
  let operation: DBOperation = 'OTHER';
  if (upper.startsWith('SELECT')) operation = 'SELECT';
  else if (upper.startsWith('INSERT')) operation = 'INSERT';
  else if (upper.startsWith('UPDATE')) operation = 'UPDATE';
  else if (upper.startsWith('DELETE')) operation = 'DELETE';

  if (operation === 'OTHER') {
    return { operation, table: undefined };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return { operation, table: undefined };
  }

  let table: string | undefined;
  try {
    if (operation === 'SELECT') {
      table = extractSelectTable(tokens);
    } else if (operation === 'INSERT') {
      let idx = 1;
      if (tokens[idx] !== undefined && tokens[idx]!.toUpperCase() === 'INTO') {
        idx++;
      }
      const candidate = tokens[idx];
      if (candidate !== undefined) {
        const cleaned = cleanToken(candidate);
        table = cleaned.length > 0 ? cleaned : undefined;
      }
    } else if (operation === 'UPDATE') {
      const candidate = tokens[1];
      if (candidate !== undefined) {
        const cleaned = cleanToken(candidate);
        table = cleaned.length > 0 ? cleaned : undefined;
      }
    } else if (operation === 'DELETE') {
      let idx = 1;
      if (tokens[idx] !== undefined && tokens[idx]!.toUpperCase() === 'FROM') {
        idx++;
      }
      const candidate = tokens[idx];
      if (candidate !== undefined) {
        const cleaned = cleanToken(candidate);
        table = cleaned.length > 0 ? cleaned : undefined;
      }
    }
  } catch {
    table = undefined;
  }

  return { operation, table };
}

function elapsedMs(start: bigint): number {
  const ns = process.hrtime.bigint() - start;
  return Number(ns) / 1_000_000;
}

async function instrumentQuery<T extends QueryResultRow>(
  text: string,
  params: unknown[] | undefined,
  fn: () => Promise<QueryResult<T>>
): Promise<QueryResult<T>> {
  const start = process.hrtime.bigint();
  const { operation, table } = parseOperationAndTable(text);
  const sqlPreview = text.slice(0, 200);

  try {
    const result = await fn();
    const durationMs = elapsedMs(start);
    logger.info(
      {
        event: 'db_query',
        status: 'success',
        durationMs,
        operation,
        table,
        sqlPreview,
        rowCount: result?.rowCount,
      },
      'db_query'
    );
    return result;
  } catch (err) {
    const durationMs = elapsedMs(start);
    const cause = (err as { cause?: unknown } | null | undefined)?.cause;
    const causeCode = (cause as { code?: string } | null | undefined)?.code;
    const causeMessage = (cause as Error | null | undefined)?.message;
    const topCode = (err as { code?: string } | null | undefined)?.code;
    const topMessage = (err as Error | null | undefined)?.message;
    const code = causeCode ?? topCode;
    const message = causeMessage ?? topMessage;
    logger.error(
      {
        event: 'db_query',
        status: 'failure',
        durationMs,
        operation,
        table,
        sqlPreview,
        error: { code, message },
      },
      'db_query'
    );
    throw err;
  }
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return instrumentQuery(text, params, async () => {
    try {
      return await pool.query<T>(text, params);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const isConnectionError =
        code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'ETIMEDOUT' ||
        (typeof code === 'string' && (code.startsWith('08') || code.startsWith('57')));

      if (isConnectionError) {
        throw new DBConnectionError('Database connection failed', { cause: err });
      }
      throw new DBQueryError('Database query failed', { cause: err, query: text.slice(0, 200) });
    }
  });
}

export async function initDatabase(): Promise<void> {
  const start = process.hrtime.bigint();
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_hash TEXT UNIQUE NOT NULL,
          filename TEXT NOT NULL,
          ingested_at TIMESTAMPTZ DEFAULT NOW(),
          row_count INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(80) NOT NULL DEFAULT 'processing',
          meta JSONB DEFAULT '{}'
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS anomalies (
          anomaly_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
          campaign_id VARCHAR(80) NOT NULL,
          date DATE,
          anomaly_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          label VARCHAR(50),
          count INTEGER NOT NULL DEFAULT 1,
          feature_snapshot JSONB DEFAULT '{}',
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID REFERENCES reports(report_id) ON DELETE SET NULL,
          anomaly_id UUID REFERENCES anomalies(anomaly_id) ON DELETE SET NULL,
          action VARCHAR(80) NOT NULL,
          actor VARCHAR(80) NOT NULL DEFAULT 'system',
          llm_prompt TEXT,
          llm_response TEXT,
          llm_insight JSONB DEFAULT '{}',
          meta JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_anomalies_report_id ON anomalies(report_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_anomalies_campaign_id ON anomalies(campaign_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_anomaly_id ON audit_logs(anomaly_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_reports_file_hash ON reports(file_hash)
      `);

      await client.query('COMMIT');
      const durationMs = elapsedMs(start);
      logger.info(
        { event: 'db_init', status: 'success', durationMs },
        'db_init'
      );
    } catch (error) {
      await client.query('ROLLBACK');
      const durationMs = elapsedMs(start);
      logger.error(
        {
          event: 'db_init',
          status: 'failure',
          durationMs,
          error: {
            name: (error as Error).name,
            message: (error as Error).message,
          },
        },
        'db_init'
      );
      throw error;
    } finally {
      client.release();
    }
  } catch (err) {
    const durationMs = elapsedMs(start);
    logger.error(
      {
        event: 'db_init',
        status: 'failure',
        durationMs,
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
        },
      },
      'db_init'
    );
    throw err;
  }
}

export default pool;
