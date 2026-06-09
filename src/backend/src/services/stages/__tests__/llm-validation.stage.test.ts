import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RawFinding,
  ValidatedAnomaly,
} from '../../../interfaces/pipeline.interface';

// Set env var before importing the module that checks it
process.env.ANTHROPIC_API_KEY = 'test-key';

// We need to mock the module before importing the function that uses it
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
    __mockCreate: mockCreate,
  };
});

// Import after mocking
import { runLLMValidationStage } from '../llm-validation.stage';
import Anthropic from '@anthropic-ai/sdk';

function createRawFinding(overrides: Partial<RawFinding> = {}): RawFinding {
  return {
    id: 'finding-1',
    campaignId: 'CMP-0001',
    date: '2025-04-15',
    type: 'CLICKS_EXCEED_IMPRESSIONS',
    metric: 'clicks',
    value: 1500,
    baseline: 50,
    zScore: undefined,
    regime: {
      id: 'regime-1',
      startDate: '2025-04-01',
      endDate: '2025-04-30',
    },
    ...overrides,
  };
}

function createMockLLMResponse(anomalies: Partial<ValidatedAnomaly>[]): object {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          anomalies: anomalies.map((a, i) => ({
            id: a.id || `finding-${i + 1}`,
            campaignId: a.campaignId || 'CMP-0001',
            date: a.date || '2025-04-15',
            type: a.type || 'CLICKS_EXCEED_IMPRESSIONS',
            severity: a.severity || 'HIGH',
            title: a.title || 'Test Anomaly',
            insight: a.insight || 'This is a test insight.',
            suggestedAction: a.suggestedAction || 'Take action.',
            confidence: a.confidence || 0.95,
            metadata: a.metadata || {
              metric: 'clicks',
              value: 1500,
              baseline: 50,
              regimeId: 'regime-1',
            },
          })),
          filtered: [],
        }),
      },
    ],
    usage: {
      input_tokens: 500,
      output_tokens: 200,
    },
  };
}

// Get the mock function
function getMockCreate(): ReturnType<typeof vi.fn> {
  const client = new Anthropic();
  return client.messages.create as ReturnType<typeof vi.fn>;
}

describe('LLM Validation Stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Validation', () => {
    it('should transform raw findings into validated anomalies', async () => {
      const findings = [createRawFinding()];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          {
            id: 'finding-1',
            severity: 'CRITICAL',
            title: 'Clicks exceed impressions',
            insight: 'This indicates data corruption - clicks cannot exceed impressions.',
            suggestedAction: 'Investigate data source and verify tracking implementation.',
          },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].severity).toBe('CRITICAL');
      expect(result.anomalies[0].title).toBe('Clicks exceed impressions');
      expect(result.anomalies[0].insight).toContain('data corruption');
    });

    it('should assign correct severity levels', async () => {
      const findings = [
        createRawFinding({ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS' }),
        createRawFinding({ id: 'f2', type: 'SPEND_WITHOUT_CLICKS' }),
        createRawFinding({ id: 'f3', type: 'CTR_DROP' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          { id: 'f1', severity: 'CRITICAL' },
          { id: 'f2', severity: 'HIGH' },
          { id: 'f3', severity: 'MEDIUM' },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(result.anomalies.find(a => a.id === 'f1')?.severity).toBe('CRITICAL');
      expect(result.anomalies.find(a => a.id === 'f2')?.severity).toBe('HIGH');
      expect(result.anomalies.find(a => a.id === 'f3')?.severity).toBe('MEDIUM');
    });

    it('should include metadata from raw findings', async () => {
      const findings = [
        createRawFinding({
          id: 'f1',
          metric: 'acos_normalised',
          value: 0.85,
          baseline: 0.25,
          zScore: 3.2,
        }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          {
            id: 'f1',
            metadata: {
              metric: 'acos_normalised',
              value: 0.85,
              baseline: 0.25,
              zScore: 3.2,
              regimeId: 'regime-1',
            },
          },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(result.anomalies[0].metadata.metric).toBe('acos_normalised');
      expect(result.anomalies[0].metadata.value).toBe(0.85);
      expect(result.anomalies[0].metadata.zScore).toBe(3.2);
    });
  });

  describe('False Positive Filtering', () => {
    it('should filter out findings marked as false positives by LLM', async () => {
      const findings = [
        createRawFinding({ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS' }),
        createRawFinding({ id: 'f2', type: 'SPEND_WITHOUT_CLICKS' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              anomalies: [
                {
                  id: 'f1',
                  campaignId: 'CMP-0001',
                  date: '2025-04-15',
                  type: 'CLICKS_EXCEED_IMPRESSIONS',
                  severity: 'HIGH',
                  title: 'Test',
                  insight: 'Test insight',
                  suggestedAction: 'Test action',
                  confidence: 0.9,
                  metadata: { metric: 'clicks', value: 1500, baseline: 50, regimeId: 'regime-1' },
                },
              ],
              filtered: [
                { id: 'f2', reason: 'Expected seasonal pattern' },
              ],
            }),
          },
        ],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const result = await runLLMValidationStage(findings);

      // 1 LLM-validated + 1 fallback for the filtered finding
      expect(result.anomalies).toHaveLength(2);
      expect(result.filtered.count).toBe(1);
      expect(result.filtered.reasons).toContain('Expected seasonal pattern');
    });
  });

  describe('Error Handling', () => {
    it('should retry on Anthropic API failure', async () => {
      const findings = [createRawFinding()];
      const mockCreate = getMockCreate();

      // Fail twice, succeed on third attempt
      mockCreate
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(createMockLLMResponse([{ id: 'finding-1', severity: 'HIGH' }]));

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.anomalies).toHaveLength(1);
    });

    it('should return raw findings with default labels after max retries', async () => {
      const findings = [
        createRawFinding({ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS' }),
      ];
      const mockCreate = getMockCreate();

      // Fail all retry attempts
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await runLLMValidationStage(findings);

      // Should return findings with default/fallback labels
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].id).toBe('f1');
      // Default severity based on type
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(result.anomalies[0].severity);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const findings = [createRawFinding()];
      const mockCreate = getMockCreate();
      const rateLimitError = new Error('Rate limited');
      (rateLimitError as Error & { status?: number }).status = 429;

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(createMockLLMResponse([{ id: 'finding-1' }]));

      const startTime = Date.now();
      const result = await runLLMValidationStage(findings);
      const elapsed = Date.now() - startTime;

      expect(result.anomalies).toHaveLength(1);
      // Should have waited at least some time for backoff
      expect(elapsed).toBeGreaterThan(100);
    });
  });

  describe('Batching', () => {
    it('should batch findings when count exceeds LLM_BATCH_SIZE', async () => {
      // Create 30 unique findings to avoid deduplication
      // With LLM_BATCH_SIZE=5, this will be 6 batches
      const findings = Array.from({ length: 30 }, (_, i) =>
        createRawFinding({ 
          id: `finding-${i}`,
          campaignId: `CMP-${String(i).padStart(4, '0')}`,
        })
      );
      const mockCreate = getMockCreate();

      // 6 batches of 5 findings each
      for (let batch = 0; batch < 6; batch++) {
        const startId = batch * 5;
        mockCreate.mockResolvedValueOnce(
          createMockLLMResponse(
            Array.from({ length: 5 }, (_, i) => ({ id: `finding-${startId + i}` }))
          )
        );
      }

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(6);
      expect(result.anomalies).toHaveLength(30);
    });

    it('should aggregate usage stats across batches', async () => {
      const findings = Array.from({ length: 30 }, (_, i) =>
        createRawFinding({ 
          id: `finding-${i}`,
          campaignId: `CMP-${String(i).padStart(4, '0')}`,
        })
      );
      const mockCreate = getMockCreate();

      // 6 batches of 5 findings each
      for (let batch = 0; batch < 6; batch++) {
        mockCreate.mockResolvedValueOnce({
          ...createMockLLMResponse(
            Array.from({ length: 5 }, (_, i) => ({ id: `finding-${batch * 5 + i}` }))
          ),
          usage: { input_tokens: 100, output_tokens: 50 },
        });
      }

      const result = await runLLMValidationStage(findings);

      // 6 batches * 100 input = 600, 6 batches * 50 output = 300
      expect(result.usage.inputTokens).toBe(600);
      expect(result.usage.outputTokens).toBe(300);
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track input and output tokens', async () => {
      const findings = [createRawFinding({ id: 'f-token', campaignId: 'CMP-TOKEN' })];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              anomalies: [
                {
                  id: 'f-token',
                  campaignId: 'CMP-TOKEN',
                  date: '2025-04-15',
                  type: 'CLICKS_EXCEED_IMPRESSIONS',
                  severity: 'HIGH',
                  title: 'Test',
                  insight: 'Test',
                  suggestedAction: 'Test',
                  confidence: 0.9,
                  metadata: { metric: 'clicks', value: 1500, baseline: 50, regimeId: 'regime-1' },
                },
              ],
              filtered: [],
            }),
          },
        ],
        usage: { input_tokens: 1500, output_tokens: 800 },
      });

      const result = await runLLMValidationStage(findings);

      expect(result.usage.inputTokens).toBe(1500);
      expect(result.usage.outputTokens).toBe(800);
    });
  });

  describe('Deduplication', () => {
    it('should collapse 3 identical findings into 1 with callCount 3', async () => {
      const findings = [
        createRawFinding({ id: 'f1' }),
        createRawFinding({ id: 'f2' }),
        createRawFinding({ id: 'f3' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([{ id: 'f1', severity: 'CRITICAL' }])
      );

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].severity).toBe('CRITICAL');
    });

    it('should deduplicate mixed duplicates and keep unique findings', async () => {
      const findings = [
        createRawFinding({ id: 'f1', type: 'CLICKS_EXCEED_IMPRESSIONS' }),
        createRawFinding({ id: 'f2', type: 'CLICKS_EXCEED_IMPRESSIONS' }),
        createRawFinding({ id: 'f3', type: 'SPEND_WITHOUT_CLICKS' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          { id: 'f1', severity: 'CRITICAL' },
          { id: 'f3', severity: 'HIGH' },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.anomalies).toHaveLength(2);
    });

    it('should NOT deduplicate findings from different campaigns', async () => {
      const findings = [
        createRawFinding({ id: 'f1', campaignId: 'CMP-0001' }),
        createRawFinding({ id: 'f2', campaignId: 'CMP-0002' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          { id: 'f1', campaignId: 'CMP-0001' },
          { id: 'f2', campaignId: 'CMP-0002' },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.anomalies).toHaveLength(2);
    });

    it('should NOT deduplicate findings on different dates', async () => {
      const findings = [
        createRawFinding({ id: 'f1', date: '2025-04-15' }),
        createRawFinding({ id: 'f2', date: '2025-04-16' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          { id: 'f1', date: '2025-04-15' },
          { id: 'f2', date: '2025-04-16' },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.anomalies).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty findings array', async () => {
      const mockCreate = getMockCreate();
      const result = await runLLMValidationStage([]);

      expect(result.anomalies).toHaveLength(0);
      expect(result.filtered.count).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should handle malformed LLM response', async () => {
      const findings = [createRawFinding()];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'invalid json' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      // Should fall back to default labeling
      const result = await runLLMValidationStage(findings);

      expect(result.anomalies).toHaveLength(1);
    });

    it('should preserve finding order', async () => {
      const findings = [
        createRawFinding({ id: 'f1', campaignId: 'CMP-0001', type: 'CLICKS_EXCEED_IMPRESSIONS', metric: 'clicks' }),
        createRawFinding({ id: 'f2', campaignId: 'CMP-0002', type: 'SPEND_WITHOUT_CLICKS', metric: 'spend' }),
        createRawFinding({ id: 'f3', campaignId: 'CMP-0003', type: 'ACOS_SPIKE', metric: 'acos' }),
      ];
      const mockCreate = getMockCreate();

      mockCreate.mockResolvedValueOnce(
        createMockLLMResponse([
          { id: 'f1', campaignId: 'CMP-0001' },
          { id: 'f2', campaignId: 'CMP-0002' },
          { id: 'f3', campaignId: 'CMP-0003' },
        ])
      );

      const result = await runLLMValidationStage(findings);

      expect(result.anomalies[0].campaignId).toBe('CMP-0001');
      expect(result.anomalies[1].campaignId).toBe('CMP-0002');
      expect(result.anomalies[2].campaignId).toBe('CMP-0003');
    });
  });
});
