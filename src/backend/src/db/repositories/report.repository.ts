import { query } from '../index.js';
import type { Report, CreateReportInput } from '../models.js';

export async function createReport(input: CreateReportInput): Promise<Report> {
  const result = await query<Report>(
    `INSERT INTO reports (file_hash, filename, row_count, status, meta)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.file_hash,
      input.filename,
      input.row_count,
      input.status || 'completed',
      JSON.stringify(input.meta || {}),
    ]
  );
  return result.rows[0];
}

export async function findReportByHash(fileHash: string): Promise<Report | null> {
  const result = await query<Report>(
    `SELECT * FROM reports WHERE file_hash = $1`,
    [fileHash]
  );
  return result.rows[0] || null;
}

export async function findReportById(reportId: string): Promise<Report | null> {
  const result = await query<Report>(
    `SELECT * FROM reports WHERE report_id = $1`,
    [reportId]
  );
  return result.rows[0] || null;
}

export async function updateReportStatus(
  reportId: string,
  status: string,
  meta?: Record<string, unknown>
): Promise<Report | null> {
  const updates: string[] = ['status = $2'];
  const params: unknown[] = [reportId, status];

  if (meta) {
    updates.push('meta = meta || $3');
    params.push(JSON.stringify(meta));
  }

  const result = await query<Report>(
    `UPDATE reports SET ${updates.join(', ')} WHERE report_id = $1 RETURNING *`,
    params
  );
  return result.rows[0] || null;
}
