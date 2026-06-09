import { v4 as uuidv4 } from 'uuid';
import type {
  PipelineInput,
  PipelineOutput,
  PipelineSuccess,
  PipelineFailure,
  ValidatedAnomaly,
  Severity
} from '../interfaces/pipeline.interface.js';
import { DEFAULT_ZSCORE_THRESHOLD, DEFAULT_ZERO_ACTIVITY_DAYS } from "../interfaces/pipeline.interface.js"
import { runDataQualityStage } from './stages/data-quality.stage.js';
import { runNormalisationStage } from './stages/normalisation.stage.js';
import { runRegimeDetectionStage } from './stages/regime-detection.stage.js';
import { runAnomalyDetectionStage } from './stages/anomaly-detection.stage.js';
import { runLLMValidationStage } from './stages/llm-validation.stage.js';

/**
 * Pipeline Orchestrator
 * 
 * Coordinates all pipeline stages:
 * 1. Data Quality (can halt pipeline on critical errors)
 * 2. Normalisation (silent fixes)
 * 3. Regime Detection (sets context for z-scores)
 * 4. Anomaly Detection (produces raw findings)
 * 5. LLM Validation (labels and filters findings)
 */

function groupAnomaliesByCampaign(
  anomalies: ValidatedAnomaly[]
): Record<string, ValidatedAnomaly[]> {
  const grouped: Record<string, ValidatedAnomaly[]> = {};

  for (const anomaly of anomalies) {
    if (!grouped[anomaly.campaignId]) {
      grouped[anomaly.campaignId] = [];
    }
    grouped[anomaly.campaignId].push(anomaly);
  }

  return grouped;
}

function countBySeverity(anomalies: ValidatedAnomaly[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const anomaly of anomalies) {
    counts[anomaly.severity]++;
  }

  return counts;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const requestId = uuidv4();
  const startTime = Date.now();

  const options = {
    zScoreThreshold: input.options?.zScoreThreshold ?? DEFAULT_ZSCORE_THRESHOLD,
    zeroActivityDays: input.options?.zeroActivityDays ?? DEFAULT_ZERO_ACTIVITY_DAYS,
  };

  // Stage 1: Data Quality
  const dataQualityResult = runDataQualityStage({ buffer: input.buffer });

  if (!dataQualityResult.success) {
    const failure: PipelineFailure = {
      success: false,
      requestId,
      error: {
        code: dataQualityResult.criticalError?.code || 'DATA_QUALITY_ERROR',
        message: dataQualityResult.criticalError?.message || 'Data quality validation failed',
        stage: 'data_quality',
      },
    };
    return failure;
  }

  // Stage 2: Normalisation
  const normalisationResult = runNormalisationStage(dataQualityResult.rows);

  // Stage 3: Regime Detection
  const regimeResult = runRegimeDetectionStage(normalisationResult.rows);

  // Stage 4: Anomaly Detection
  const anomalyResult = runAnomalyDetectionStage(regimeResult, options);

  // Stage 5: LLM Validation
  const llmResult = await runLLMValidationStage(anomalyResult.findings);

  // Build success response
  const processingTime = Date.now() - startTime;
  const anomaliesByCampaign = groupAnomaliesByCampaign(llmResult.anomalies);
  const bySeverity = countBySeverity(llmResult.anomalies);

  const success: PipelineSuccess = {
    success: true,
    requestId,
    report: {
      id: uuidv4(),
      totalRows: normalisationResult.stats.inputCount,
      validRows: normalisationResult.stats.outputCount,
      regimesDetected: regimeResult.regimes.length,
      anomaliesFound: llmResult.anomalies.length,
      bySeverity,
      processingTime_ms: processingTime,
    },
    anomaliesByCampaign,
  };

  return success;
}
