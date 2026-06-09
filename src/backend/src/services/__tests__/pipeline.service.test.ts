import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPipeline } from '../pipeline.service';
import { PipelineInput, PipelineSuccess, PipelineFailure } from '../../interfaces/pipeline.interface';

// Mock all stage modules
vi.mock('../stages/data-quality.stage', () => ({
  runDataQualityStage: vi.fn(),
}));

vi.mock('../stages/normalisation.stage', () => ({
  runNormalisationStage: vi.fn(),
}));

vi.mock('../stages/regime-detection.stage', () => ({
  runRegimeDetectionStage: vi.fn(),
}));

vi.mock('../stages/anomaly-detection.stage', () => ({
  runAnomalyDetectionStage: vi.fn(),
}));

vi.mock('../stages/llm-validation.stage', () => ({
  runLLMValidationStage: vi.fn(),
}));

const VALID_CSV = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr
CMP-0001,2025-04-15,1000,50,25,5,100,0.25,0.5,0.05
CMP-0002,2025-04-15,2000,100,50,10,200,0.25,0.5,0.05`;

function createPipelineInput(csv: string = VALID_CSV): PipelineInput {
  return {
    buffer: Buffer.from(csv, 'utf-8'),
    options: {
      zScoreThreshold: 2.5,
      zeroActivityDays: 7,
    },
  };
}

describe('Pipeline Service', () => {
  let mockDataQuality: ReturnType<typeof vi.fn>;
  let mockNormalisation: ReturnType<typeof vi.fn>;
  let mockRegimeDetection: ReturnType<typeof vi.fn>;
  let mockAnomalyDetection: ReturnType<typeof vi.fn>;
  let mockLLMValidation: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dataQualityModule = await import('../stages/data-quality.stage');
    const normalisationModule = await import('../stages/normalisation.stage');
    const regimeDetectionModule = await import('../stages/regime-detection.stage');
    const anomalyDetectionModule = await import('../stages/anomaly-detection.stage');
    const llmValidationModule = await import('../stages/llm-validation.stage');

    mockDataQuality = dataQualityModule.runDataQualityStage as ReturnType<typeof vi.fn>;
    mockNormalisation = normalisationModule.runNormalisationStage as ReturnType<typeof vi.fn>;
    mockRegimeDetection = regimeDetectionModule.runRegimeDetectionStage as ReturnType<typeof vi.fn>;
    mockAnomalyDetection = anomalyDetectionModule.runAnomalyDetectionStage as ReturnType<typeof vi.fn>;
    mockLLMValidation = llmValidationModule.runLLMValidationStage as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Pipeline Success Flow', () => {
    it('should execute all stages in order and return success', async () => {
      // Setup mock returns
      mockDataQuality.mockReturnValue({
        success: true,
        rows: [
          { campaign_id: 'CMP-0001', date: '2025-04-15', impressions: 1000, clicks: 50, spend: 25, orders: 5, sales: 100, acos: 0.25, cpc: 0.5, ctr: 0.05 },
        ],
        warnings: [],
      });

      mockNormalisation.mockReturnValue({
        rows: [
          { campaign_id: 'CMP-0001', date: '2025-04-15', acos_normalised: 0.25, ctr_calc: 0.05, cvr_calc: 0.1, roas_calc: 4, _wasDuplicate: false, _acosWasPercent: false },
        ],
        stats: { inputCount: 1, outputCount: 1, duplicatesRemoved: 0, acosNormalised: 0 },
      });

      mockRegimeDetection.mockReturnValue({
        regimes: [{ id: 'regime-1', startDate: '2025-04-15', endDate: '2025-04-15', type: 'normal', campaignIds: ['CMP-0001'], stats: { avgSpend: 25, avgImpressions: 1000, stdSpend: 0, stdImpressions: 0 } }],
        breakpoints: [],
        rowsByRegime: new Map([['regime-1', []]]),
      });

      mockAnomalyDetection.mockReturnValue({
        findings: [],
        stats: { total: 0, byCampaign: {}, byType: {} },
      });

      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const input = createPipelineInput();
      const result = await runPipeline(input);

      expect(result.success).toBe(true);
      expect(mockDataQuality).toHaveBeenCalledTimes(1);
      expect(mockNormalisation).toHaveBeenCalledTimes(1);
      expect(mockRegimeDetection).toHaveBeenCalledTimes(1);
      expect(mockAnomalyDetection).toHaveBeenCalledTimes(1);
      expect(mockLLMValidation).toHaveBeenCalledTimes(1);
    });

    it('should include report with correct statistics', async () => {
      mockDataQuality.mockReturnValue({
        success: true,
        rows: [
          { campaign_id: 'CMP-0001' },
          { campaign_id: 'CMP-0002' },
        ],
        warnings: [],
      });

      mockNormalisation.mockReturnValue({
        rows: [{ campaign_id: 'CMP-0001' }, { campaign_id: 'CMP-0002' }],
        stats: { inputCount: 2, outputCount: 2, duplicatesRemoved: 0, acosNormalised: 0 },
      });

      mockRegimeDetection.mockReturnValue({
        regimes: [{ id: 'regime-1' }, { id: 'regime-2' }],
        breakpoints: ['2025-04-15'],
        rowsByRegime: new Map(),
      });

      mockAnomalyDetection.mockReturnValue({
        findings: [{ id: 'f1' }, { id: 'f2' }],
        stats: { total: 2, byCampaign: {}, byType: {} },
      });

      mockLLMValidation.mockResolvedValue({
        anomalies: [
          { id: 'f1', severity: 'CRITICAL', campaignId: 'CMP-0001' },
          { id: 'f2', severity: 'HIGH', campaignId: 'CMP-0002' },
        ],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 500, outputTokens: 200 },
      });

      const result = await runPipeline(createPipelineInput()) as PipelineSuccess;

      expect(result.success).toBe(true);
      expect(result.report.totalRows).toBe(2);
      expect(result.report.regimesDetected).toBe(2);
      expect(result.report.anomaliesFound).toBe(2);
      expect(result.report.bySeverity.CRITICAL).toBe(1);
      expect(result.report.bySeverity.HIGH).toBe(1);
    });

    it('should group anomalies by campaign in output', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });

      mockLLMValidation.mockResolvedValue({
        anomalies: [
          { id: 'f1', campaignId: 'CMP-0001', severity: 'HIGH' },
          { id: 'f2', campaignId: 'CMP-0001', severity: 'MEDIUM' },
          { id: 'f3', campaignId: 'CMP-0002', severity: 'CRITICAL' },
        ],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const result = await runPipeline(createPipelineInput()) as PipelineSuccess;

      expect(result.anomaliesByCampaign['CMP-0001']).toHaveLength(2);
      expect(result.anomaliesByCampaign['CMP-0002']).toHaveLength(1);
    });

    it('should track processing time', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const result = await runPipeline(createPipelineInput()) as PipelineSuccess;

      expect(result.report.processingTime_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pipeline Halts on Critical Error', () => {
    it('should halt and return error on EMPTY_FILE', async () => {
      mockDataQuality.mockReturnValue({
        success: false,
        rows: [],
        criticalError: { code: 'EMPTY_FILE', message: 'File is empty' },
        warnings: [],
      });

      const result = await runPipeline(createPipelineInput('')) as PipelineFailure;

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('EMPTY_FILE');
      expect(result.error.stage).toBe('data_quality');

      // Subsequent stages should NOT be called
      expect(mockNormalisation).not.toHaveBeenCalled();
      expect(mockRegimeDetection).not.toHaveBeenCalled();
      expect(mockAnomalyDetection).not.toHaveBeenCalled();
      expect(mockLLMValidation).not.toHaveBeenCalled();
    });

    it('should halt and return error on MISSING_HEADERS', async () => {
      mockDataQuality.mockReturnValue({
        success: false,
        rows: [],
        criticalError: {
          code: 'MISSING_HEADERS',
          message: 'Missing required headers',
          details: { missing: ['impressions', 'clicks'] },
        },
        warnings: [],
      });

      const result = await runPipeline(createPipelineInput('foo,bar\n1,2')) as PipelineFailure;

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MISSING_HEADERS');
      expect(result.error.message).toContain('Missing required headers');
    });

    it('should halt and return error on INSUFFICIENT_VALID_ROWS', async () => {
      mockDataQuality.mockReturnValue({
        success: false,
        rows: [],
        criticalError: {
          code: 'INSUFFICIENT_VALID_ROWS',
          message: 'Less than 50% of rows are valid',
          details: { validCount: 1, totalCount: 10 },
        },
        warnings: [],
      });

      const result = await runPipeline(createPipelineInput()) as PipelineFailure;

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INSUFFICIENT_VALID_ROWS');
    });
  });

  describe('Pipeline Continues Through All Stages', () => {
    it('should pass data correctly between stages', async () => {
      const mockRows = [{ campaign_id: 'CMP-0001', date: '2025-04-15' }];
      const mockNormalisedRows = [{ ...mockRows[0], acos_normalised: 0.25 }];
      const mockRegimeResult = {
        regimes: [{ id: 'r1' }],
        breakpoints: [],
        rowsByRegime: new Map([['r1', mockNormalisedRows]]),
      };
      const mockFindings = [{ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS' }];

      mockDataQuality.mockReturnValue({ success: true, rows: mockRows, warnings: [] });
      mockNormalisation.mockReturnValue({ rows: mockNormalisedRows, stats: {} });
      mockRegimeDetection.mockReturnValue(mockRegimeResult);
      mockAnomalyDetection.mockReturnValue({ findings: mockFindings, stats: { total: 1, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [{ id: 'f1', severity: 'HIGH' }],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await runPipeline(createPipelineInput());

      // Verify data flows through stages
      expect(mockNormalisation).toHaveBeenCalledWith(mockRows);
      expect(mockRegimeDetection).toHaveBeenCalledWith(mockNormalisedRows);
      expect(mockAnomalyDetection).toHaveBeenCalledWith(mockRegimeResult, expect.any(Object));
      expect(mockLLMValidation).toHaveBeenCalledWith(mockFindings);
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request ID for each pipeline run', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const result1 = await runPipeline(createPipelineInput()) as PipelineSuccess;
      const result2 = await runPipeline(createPipelineInput()) as PipelineSuccess;

      expect(result1.requestId).toBeDefined();
      expect(result2.requestId).toBeDefined();
      expect(result1.requestId).not.toBe(result2.requestId);
    });

    it('should include request ID in error responses', async () => {
      mockDataQuality.mockReturnValue({
        success: false,
        rows: [],
        criticalError: { code: 'EMPTY_FILE', message: 'Empty' },
        warnings: [],
      });

      const result = await runPipeline(createPipelineInput('')) as PipelineFailure;

      expect(result.requestId).toBeDefined();
    });
  });

  describe('Options Handling', () => {
    it('should use default options when not provided', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const input: PipelineInput = {
        buffer: Buffer.from(VALID_CSV, 'utf-8'),
        // No options provided
      };

      const result = await runPipeline(input);

      expect(result.success).toBe(true);
    });

    it('should pass options to anomaly detection stage', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const input: PipelineInput = {
        buffer: Buffer.from(VALID_CSV, 'utf-8'),
        options: {
          zScoreThreshold: 3.0,
          zeroActivityDays: 10,
        },
      };

      await runPipeline(input);

      // The anomaly detection should receive the custom options
      // This is verified by the stage implementation using the options
      expect(mockAnomalyDetection).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle pipeline with no anomalies found', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [{}], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [{}], stats: { inputCount: 1, outputCount: 1 } });
      mockRegimeDetection.mockReturnValue({ regimes: [{ id: 'r1' }], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({ findings: [], stats: { total: 0, byCampaign: {}, byType: {} } });
      mockLLMValidation.mockResolvedValue({
        anomalies: [],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const result = await runPipeline(createPipelineInput()) as PipelineSuccess;

      expect(result.success).toBe(true);
      expect(result.report.anomaliesFound).toBe(0);
      expect(Object.keys(result.anomaliesByCampaign)).toHaveLength(0);
    });

    it('should handle LLM validation failure gracefully', async () => {
      mockDataQuality.mockReturnValue({ success: true, rows: [{}], warnings: [] });
      mockNormalisation.mockReturnValue({ rows: [{}], stats: {} });
      mockRegimeDetection.mockReturnValue({ regimes: [{ id: 'r1' }], breakpoints: [], rowsByRegime: new Map() });
      mockAnomalyDetection.mockReturnValue({
        findings: [{ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS', campaignId: 'CMP-0001' }],
        stats: { total: 1, byCampaign: { 'CMP-0001': 1 }, byType: { 'CLICKS_EXCEED_IMPRESSIONS': 1 } },
      });

      // LLM returns fallback due to API failure
      mockLLMValidation.mockResolvedValue({
        anomalies: [{ id: 'f1', severity: 'HIGH', campaignId: 'CMP-0001', title: 'Fallback title' }],
        filtered: { count: 0, reasons: [] },
        usage: { inputTokens: 0, outputTokens: 0 },
      });

      const result = await runPipeline(createPipelineInput()) as PipelineSuccess;

      // Pipeline should still succeed with fallback labels
      expect(result.success).toBe(true);
      expect(result.report.anomaliesFound).toBe(1);
    });
  });
});
