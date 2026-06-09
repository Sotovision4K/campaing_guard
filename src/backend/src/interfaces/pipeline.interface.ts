import { CSVRow } from './csv-row.interface';

// ============================================================================
// Anomaly Types
// ============================================================================

export type AnomalyType =
  | 'CLICKS_EXCEED_IMPRESSIONS'
  | 'SPEND_WITHOUT_CLICKS'
  | 'ACOS_SPIKE'
  | 'MONEY_LEAKAGE'
  | 'ROAS_DROP_CRITICAL'
  | 'ROAS_DROP'
  | 'CVR_ANOMALY'
  | 'CTR_DROP'
  | 'ZERO_ACTIVITY_CAMPAIGN';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type PipelineStage =
  | 'data_quality'
  | 'normalisation'
  | 'regime_detection'
  | 'anomaly_detection'
  | 'llm_validation';

// ============================================================================
// Stage 1: Data Quality
// ============================================================================

export interface DataQualityInput {
  buffer: Buffer;
}

export type CriticalErrorCode = 'EMPTY_FILE' | 'MISSING_HEADERS' | 'INSUFFICIENT_VALID_ROWS';

export interface CriticalError {
  code: CriticalErrorCode;
  message: string;
  details?: {
    missing?: string[];
    validCount?: number;
    totalCount?: number;
  };
}

export interface Warning {
  rowIndex: number;
  field: string;
  message: string;
}

export interface DataQualityResult {
  success: boolean;
  rows: CSVRow[];
  criticalError?: CriticalError;
  warnings: Warning[];
}

// ============================================================================
// Stage 2: Normalisation
// ============================================================================

export interface NormalisedRow extends CSVRow {
  acos_normalised: number;
  ctr_calc: number;
  cvr_calc: number;
  roas_calc: number;
  _wasDuplicate: boolean;
  _acosWasPercent: boolean;
  _acosIsAnomaly?: boolean;
}

export interface NormalisationStats {
  inputCount: number;
  outputCount: number;
  duplicatesRemoved: number;
  acosNormalised: number;
}

export interface NormalisationResult {
  rows: NormalisedRow[];
  stats: NormalisationStats;
}

// ============================================================================
// Stage 3: Regime Detection
// ============================================================================

export type RegimeType = 'normal' | 'high_spend' | 'low_activity';

export interface RegimeStats {
  avgSpend: number;
  avgImpressions: number;
  stdSpend: number;
  stdImpressions: number;
}

export interface Regime {
  id: string;
  startDate: string;
  endDate: string;
  type: RegimeType;
  campaignIds: string[];
  stats: RegimeStats;
}

export interface RegimeDetectionResult {
  regimes: Regime[];
  breakpoints: string[];
  rowsByRegime: Map<string, NormalisedRow[]>;
}

// ============================================================================
// Stage 4: Anomaly Detection
// ============================================================================

export interface RegimeContext {
  id: string;
  startDate: string;
  endDate: string;
}

export interface RawFinding {
  id: string;
  campaignId: string;
  date: string;
  type: AnomalyType;
  metric: string;
  value: number;
  baseline: number;
  zScore?: number;
  regime: RegimeContext;
  severityHint?: Severity;
  callCount?: number;
  isDuplicate?: boolean;
}

export interface AnomalyDetectionStats {
  total: number;
  byCampaign: Record<string, number>;
  byType: Partial<Record<AnomalyType, number>>;
}

export interface AnomalyDetectionResult {
  findings: RawFinding[];
  stats: AnomalyDetectionStats;
}

// ============================================================================
// Stage 5: LLM Validation
// ============================================================================

export interface AnomalyMetadata {
  metric: string;
  value: number;
  baseline: number;
  zScore?: number;
  regimeId: string;
}

export interface ValidatedAnomaly {
  id: string;
  campaignId: string;
  date: string;
  type: AnomalyType;
  severity: Severity;
  title: string;
  insight: string;
  suggestedAction: string;
  confidence: number;
  metadata: AnomalyMetadata;
}

export interface LLMValidationResult {
  anomalies: ValidatedAnomaly[];
  filtered: {
    count: number;
    reasons: string[];
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Pipeline Orchestrator
// ============================================================================

export interface PipelineOptions {
  zScoreThreshold?: number;
  zeroActivityDays?: number;
}

export interface PipelineInput {
  buffer: Buffer;
  options?: PipelineOptions;
}

export interface PipelineReport {
  id: string;
  totalRows: number;
  validRows: number;
  regimesDetected: number;
  anomaliesFound: number;
  bySeverity: Record<Severity, number>;
  processingTime_ms: number;
}

export interface PipelineSuccess {
  success: true;
  requestId: string;
  report: PipelineReport;
  anomaliesByCampaign: Record<string, ValidatedAnomaly[]>;
}

export interface PipelineFailure {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    stage: PipelineStage;
  };
}

export type PipelineOutput = PipelineSuccess | PipelineFailure;

// ============================================================================
// Audit Log Entity
// ============================================================================

export interface AuditLog {
  id: string;
  requestId: string;
  timestamp: Date;
  stage: PipelineStage;
  action: string;
  input?: object;
  output?: object;
  duration_ms: number;
  status: 'success' | 'failure' | 'skipped';
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_ZSCORE_THRESHOLD = 2.5;
export const DEFAULT_ZERO_ACTIVITY_DAYS = 7;
export const CRITICAL_VALID_ROW_THRESHOLD = 0.5;
export const LLM_BATCH_SIZE = 5;
export const LLM_MAX_RETRIES = 3;
export const LLM_MAX_TOKENS = 2000;
export const TOP_ANOMALIES_PER_CAMPAIGN = 3;
export const LLM_MODEL_VALIDATION = 'claude-haiku-4-5-20251001';
export const LLM_MODEL_DEEP_INSIGHT = 'claude-sonnet-4-6';

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
