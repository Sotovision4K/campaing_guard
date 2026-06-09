export interface Report {
  report_id: string;
  file_hash: string;
  filename: string;
  ingested_at: Date;
  row_count: number;
  status: string;
  meta: Record<string, unknown>;
}

export interface Anomaly {
  anomaly_id: string;
  report_id: string;
  campaign_id: string;
  date: string | null;
  anomaly_type: string;
  severity: string;
  label: string | null;
  count: number;
  feature_snapshot: Record<string, unknown>;
  status: 'open' | 'rejected' | 'approved' | 'investigating' | 'pending_insight';
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  log_id: string;
  report_id: string | null;
  anomaly_id: string | null;
  action: string;
  actor: string;
  llm_prompt: string | null;
  llm_response: string | null;
  llm_insight: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  created_at: Date;
}

export interface CreateReportInput {
  file_hash: string;
  filename: string;
  row_count: number;
  status?: string;
  meta?: Record<string, unknown>;
}

export interface CreateAnomalyInput {
  report_id: string;
  campaign_id: string;
  date?: string;
  anomaly_type: string;
  severity: string;
  label?: string;
  count?: number;
  feature_snapshot?: Record<string, unknown>;
  status?: 'open' | 'rejected' | 'approved' | 'investigating' | 'pending_insight';
}

export interface CreateAuditLogInput {
  report_id?: string | null;
  anomaly_id?: string | null;
  action: string;
  actor?: string;
  llm_prompt?: string | null;
  llm_response?: string | null;
  llm_insight?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
}
