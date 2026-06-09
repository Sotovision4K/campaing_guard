import { query } from '../index.js';
import type { AuditLog, CreateAuditLogInput } from '../models.js';

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const result = await query<AuditLog>(
    `INSERT INTO audit_logs 
     (report_id, anomaly_id, action, actor, llm_prompt, llm_response, llm_insight, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.report_id || null,
      input.anomaly_id || null,
      input.action,
      input.actor || 'system',
      input.llm_prompt || null,
      input.llm_response || null,
      input.llm_insight ? JSON.stringify(input.llm_insight) : null,
      JSON.stringify(input.meta || {}),
    ]
  );
  return result.rows[0];
}

export async function findAuditLogsByAnomalyId(anomalyId: string): Promise<AuditLog[]> {
  const result = await query<AuditLog>(
    `SELECT * FROM audit_logs WHERE anomaly_id = $1 ORDER BY created_at DESC`,
    [anomalyId]
  );
  return result.rows;
}

export async function findAuditLogsByReportId(reportId: string): Promise<AuditLog[]> {
  const result = await query<AuditLog>(
    `SELECT * FROM audit_logs WHERE report_id = $1 ORDER BY created_at DESC`,
    [reportId]
  );
  return result.rows;
}

export async function getAuditLogsWithPagination(
  filters: {
    anomalyId?: string;
    reportId?: string;
    action?: string;
    actor?: string;
  },
  limit = 50,
  offset = 0
): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.anomalyId) {
    conditions.push(`anomaly_id = $${paramIndex++}`);
    params.push(filters.anomalyId);
  }
  if (filters.reportId) {
    conditions.push(`report_id = $${paramIndex++}`);
    params.push(filters.reportId);
  }
  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters.actor) {
    conditions.push(`actor = $${paramIndex++}`);
    params.push(filters.actor);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
    params
  );

  const logsResult = await query<AuditLog>(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}
