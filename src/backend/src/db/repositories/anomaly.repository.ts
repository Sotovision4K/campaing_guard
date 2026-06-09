import { query } from '../index.js';
import type { Anomaly, CreateAnomalyInput } from '../models.js';

export async function createAnomaly(input: CreateAnomalyInput): Promise<Anomaly> {
  const result = await query<Anomaly>(
    `INSERT INTO anomalies 
     (report_id, campaign_id, date, anomaly_type, severity, label, count, feature_snapshot, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.report_id,
      input.campaign_id,
      input.date || null,
      input.anomaly_type,
      input.severity,
      input.label || null,
      input.count || 1,
      JSON.stringify(input.feature_snapshot || {}),
      input.status || 'open',
    ]
  );
  return result.rows[0];
}

export async function findOrCreateAnomaly(
  input: CreateAnomalyInput
): Promise<Anomaly> {
  // Check for existing anomaly with same report_id, campaign_id, type, and date
  const existing = await query<Anomaly>(
    `SELECT * FROM anomalies 
     WHERE report_id = $1 AND campaign_id = $2 AND anomaly_type = $3 
     AND (date = $4 OR (date IS NULL AND $4 IS NULL))`,
    [input.report_id, input.campaign_id, input.anomaly_type, input.date || null]
  );

  if (existing.rows[0]) {
    // Increment count and return updated
    const updated = await query<Anomaly>(
      `UPDATE anomalies 
       SET count = count + 1, updated_at = NOW(),
           feature_snapshot = feature_snapshot || $2
       WHERE anomaly_id = $1
       RETURNING *`,
      [existing.rows[0].anomaly_id, JSON.stringify(input.feature_snapshot || {})]
    );
    return updated.rows[0];
  }

  return createAnomaly(input);
}

export async function findAnomaliesByReportId(reportId: string): Promise<Anomaly[]> {
  const result = await query<Anomaly>(
    `SELECT * FROM anomalies WHERE report_id = $1 ORDER BY created_at DESC`,
    [reportId]
  );
  return result.rows;
}

export async function findAnomalyById(anomalyId: string): Promise<Anomaly | null> {
  const result = await query<Anomaly>(
    `SELECT * FROM anomalies WHERE anomaly_id = $1`,
    [anomalyId]
  );
  return result.rows[0] || null;
}

export async function findAnomaliesByCampaignId(campaignId: string): Promise<Anomaly[]> {
  const result = await query<Anomaly>(
    `SELECT * FROM anomalies WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [campaignId]
  );
  return result.rows;
}

export async function updateAnomalyStatus(
  anomalyId: string,
  status: 'open' | 'rejected' | 'approved' | 'investigating'
): Promise<Anomaly | null> {
  const result = await query<Anomaly>(
    `UPDATE anomalies SET status = $2, updated_at = NOW() WHERE anomaly_id = $1 RETURNING *`,
    [anomalyId, status]
  );
  return result.rows[0] || null;
}

export async function getAnomaliesWithPagination(
  filters: {
    reportId?: string;
    campaignId?: string;
    status?: string;
    severity?: string;
  },
  limit = 50,
  offset = 0
): Promise<{ anomalies: Anomaly[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.reportId) {
    conditions.push(`report_id = $${paramIndex++}`);
    params.push(filters.reportId);
  }
  if (filters.campaignId) {
    conditions.push(`campaign_id = $${paramIndex++}`);
    params.push(filters.campaignId);
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(filters.severity);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM anomalies ${whereClause}`,
    params
  );

  const anomaliesResult = await query<Anomaly>(
    `SELECT * FROM anomalies ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    anomalies: anomaliesResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}
