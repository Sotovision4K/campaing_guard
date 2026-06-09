import apiClient, { type ApiResponse } from '../api/client';

export interface Anomaly {
  anomaly_id: string;
  report_id: string;
  campaign_id: string;
  date: string | null;
  anomaly_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  label: string | null;
  count: number;
  feature_snapshot: Record<string, unknown>;
  status: 'open' | 'rejected' | 'approved' | 'investigating' | 'pending_insight';
  created_at: string;
  updated_at: string;
}

export interface AnomalyListResponse {
  anomalies: Anomaly[];
  total: number;
}

export interface AnomalyDetailResponse {
  anomaly: Anomaly;
  auditLogs: AuditLog[];
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
  created_at: string;
}

export const listAnomalies = async (
  filters?: {
    reportId?: string;
    campaignId?: string;
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ApiResponse<AnomalyListResponse>> => {
  const params = new URLSearchParams();
  if (filters?.reportId) params.append('reportId', filters.reportId);
  if (filters?.campaignId) params.append('campaignId', filters.campaignId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

  const response = await apiClient.get<ApiResponse<AnomalyListResponse>>(
    `/anomaly?${params.toString()}`
  );
  return response.data;
};

export const getAnomaly = async (id: string): Promise<ApiResponse<AnomalyDetailResponse>> => {
  const response = await apiClient.get<ApiResponse<AnomalyDetailResponse>>(`/anomaly/${id}`);
  return response.data;
};

export const rejectAnomaly = async (
  id: string,
  reason?: string
): Promise<ApiResponse<Anomaly>> => {
  const response = await apiClient.post<ApiResponse<Anomaly>>(`/anomaly/${id}/reject`, {
    reason,
  });
  return response.data;
};

export const approveAnomaly = async (
  id: string,
  reason?: string,
  action?: string
): Promise<ApiResponse<Anomaly>> => {
  const response = await apiClient.post<ApiResponse<Anomaly>>(`/anomaly/${id}/approve`, {
    reason,
    action,
  });
  return response.data;
};

export const listAuditLogs = async (
  filters?: {
    anomalyId?: string;
    reportId?: string;
    action?: string;
    actor?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ApiResponse<{ logs: AuditLog[]; total: number }>> => {
  const params = new URLSearchParams();
  if (filters?.anomalyId) params.append('anomalyId', filters.anomalyId);
  if (filters?.reportId) params.append('reportId', filters.reportId);
  if (filters?.action) params.append('action', filters.action);
  if (filters?.actor) params.append('actor', filters.actor);
  if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

  const response = await apiClient.get<ApiResponse<{ logs: AuditLog[]; total: number }>>(
    `/anomaly/audit-logs?${params.toString()}`
  );
  return response.data;
};
