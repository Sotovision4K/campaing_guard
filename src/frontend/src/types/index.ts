export interface CSVRow {
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  acos: number;
  cpc: number;
  ctr: number;
  cvr: number;
  roas: number;
}

export type ValidationErrorCode =
  | 'MISSING_CAMPAIGN_ID'
  | 'INVALID_DATE'
  | 'CLICKS_NOT_NUMERIC'
  | 'NEGATIVE_SPEND'
  | 'CLICKS_EXCEED_IMPRESSIONS'
  | 'NEGATIVE_IMPRESSIONS'
  | 'ORDERS_EXCEED_CLICKS';

export interface ValidationError {
  field: string;
  code: ValidationErrorCode;
  message: string;
  rowIndex: number;
}

export interface InvalidRow {
  row: CSVRow;
  errors: ValidationError[];
}

export interface SeverityCount {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface ReportSummary {
  id: string;
  totalRows: number;
  validRows: number;
  regimesDetected: number;
  anomaliesFound: number;
  bySeverity: SeverityCount;
  processingTime_ms: number;
}

export interface ValidatedAnomaly {
  id: string;
  campaignId: string;
  date: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  insight: string;
  suggestedAction: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface UploadResponse {
  report: ReportSummary;
  anomaliesByCampaign: Record<string, ValidatedAnomaly[]>;
}

export interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'waiting' | 'error';
  progress: number;
  data: UploadResponse | null;
  error: string | null;
}
