import { Pool, type PoolConfig, type QueryResult } from 'pg';
import dotenv from 'dotenv';

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

// Allow DATABASE_URL to override individual settings
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  // Let pg parse the connection string, but keep pool sizing
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

import type { QueryResultRow } from 'pg';

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reports table
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

    // Anomalies table
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

    // Audit logs table
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

    // Indexes for performance
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
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
