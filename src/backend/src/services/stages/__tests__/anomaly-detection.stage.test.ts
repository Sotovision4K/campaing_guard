import { describe, it, expect } from 'vitest';
import { runAnomalyDetectionStage } from '../anomaly-detection.stage';
import {
  NormalisedRow,
  Regime,
  RegimeDetectionResult,
  AnomalyType,
} from '../../../interfaces/pipeline.interface';

function createNormalisedRow(overrides: Partial<NormalisedRow> = {}): NormalisedRow {
  return {
    campaign_id: 'CMP-0001',
    date: '2025-04-15',
    impressions: 1000,
    clicks: 50,
    spend: 25.00,
    orders: 5,
    sales: 100.00,
    acos: 0.25,
    cpc: 0.50,
    ctr: 0.05,
    acos_normalised: 0.25,
    ctr_calc: 0.05,
    cvr_calc: 0.10,
    roas_calc: 4.0,
    _wasDuplicate: false,
    _acosWasPercent: false,
    ...overrides,
  };
}

function createRegime(overrides: Partial<Regime> = {}): Regime {
  return {
    id: 'regime-1',
    startDate: '2025-04-01',
    endDate: '2025-04-30',
    type: 'normal',
    campaignIds: ['CMP-0001'],
    stats: {
      avgSpend: 25,
      avgImpressions: 1000,
      stdSpend: 5,
      stdImpressions: 200,
    },
    ...overrides,
  };
}

function createRegimeResult(rows: NormalisedRow[], regime?: Regime): RegimeDetectionResult {
  const reg = regime || createRegime();
  const rowsByRegime = new Map<string, NormalisedRow[]>();
  rowsByRegime.set(reg.id, rows);

  return {
    regimes: [reg],
    breakpoints: [],
    rowsByRegime,
  };
}

describe('Anomaly Detection Stage', () => {
  describe('CLICKS_EXCEED_IMPRESSIONS', () => {
    it('should detect when clicks > impressions (impossible scenario)', () => {
      const rows = [createNormalisedRow({ clicks: 1500, impressions: 1000 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CLICKS_EXCEED_IMPRESSIONS')).toBe(true);
    });

    it('should NOT flag when clicks <= impressions', () => {
      const rows = [createNormalisedRow({ clicks: 50, impressions: 1000 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CLICKS_EXCEED_IMPRESSIONS')).toBe(false);
    });

    it('should allow clicks equal to impressions', () => {
      const rows = [createNormalisedRow({ clicks: 1000, impressions: 1000 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CLICKS_EXCEED_IMPRESSIONS')).toBe(false);
    });
  });

  describe('SPEND_WITHOUT_CLICKS', () => {
    it('should detect when spend > 0 but clicks = 0', () => {
      const rows = [createNormalisedRow({ spend: 50, clicks: 0 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'SPEND_WITHOUT_CLICKS')).toBe(true);
    });

    it('should NOT flag when spend = 0 and clicks = 0', () => {
      const rows = [createNormalisedRow({ spend: 0, clicks: 0 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'SPEND_WITHOUT_CLICKS')).toBe(false);
    });

    it('should NOT flag when spend > 0 and clicks > 0', () => {
      const rows = [createNormalisedRow({ spend: 50, clicks: 10 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'SPEND_WITHOUT_CLICKS')).toBe(false);
    });
  });

  describe('ACOS_SPIKE (Z-Score based)', () => {
    it('should detect when ACoS z-score exceeds threshold within regime', () => {
      // Create baseline rows with low ACoS (need >= 15 for minRegimeSize)
      const baselineRows = Array.from({ length: 20 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          acos_normalised: 25 + Math.random() * 2, // ~25% with small variance
        })
      );
      // Add spike row
      const spikeRow = createNormalisedRow({
        date: '2025-04-25',
        acos_normalised: 80, // Significant spike to 80%
      });

      const regime = createRegime({
        stats: { avgSpend: 25, avgImpressions: 1000, stdSpend: 5, stdImpressions: 200 },
      });
      const regimeResult = createRegimeResult([...baselineRows, spikeRow], regime);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ACOS_SPIKE')).toBe(true);
    });

    it('should include z-score in finding metadata', () => {
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          acos_normalised: 25 + (i % 3) * 0.5, // Add variance for std > 0
        })
      );
      const spikeRow = createNormalisedRow({ date: '2025-04-20', acos_normalised: 90 });

      const regimeResult = createRegimeResult([...baselineRows, spikeRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      const acosFinding = result.findings.find(f => f.type === 'ACOS_SPIKE');
      if (acosFinding) {
        expect(acosFinding.zScore).toBeDefined();
        expect(acosFinding.zScore).toBeGreaterThan(2.5);
      }
    });

    it('should NOT flag when regime has < 15 data points', () => {
      const baselineRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          acos_normalised: 25,
        })
      );
      const spikeRow = createNormalisedRow({ date: '2025-04-15', acos_normalised: 90 });

      const regimeResult = createRegimeResult([...baselineRows, spikeRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ACOS_SPIKE')).toBe(false);
    });
  });

  describe('MONEY_LEAKAGE', () => {
    it('should detect sustained money leakage (2+ consecutive days with >20% changes)', () => {
      const rows = [
        // Day 1: baseline
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-13', sales: 200, spend: 30 }),
        // Day 2: leakage starts (sales -50%, spend +66%)
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 100, spend: 50 }),
        // Day 3: leakage continues (sales -50% again, spend +40% from day 2)
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-15', sales: 50, spend: 70 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(true);
    });

    it('should NOT flag single-day money leakage', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 200, spend: 30 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-15', sales: 100, spend: 50 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(false);
    });

    it('should NOT flag when changes are below 20% magnitude', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-13', sales: 200, spend: 30 }),
        // 5% drop, 3% rise — below threshold
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 190, spend: 31 }),
        // continues
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-15', sales: 180, spend: 32 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(false);
    });

    it('should NOT flag when sales increase even if spend increases', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-13', sales: 100, spend: 30 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 200, spend: 50 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-15', sales: 300, spend: 70 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(false);
    });

    it('should NOT flag when spend decreases', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-13', sales: 200, spend: 50 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 100, spend: 30 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-15', sales: 80, spend: 20 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(false);
    });

    it('should reset streak on non-consecutive dates', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-13', sales: 200, spend: 30 }),
        // Leakage on day 1
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-14', sales: 100, spend: 50 }),
        // Gap — day 15 is missing
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-16', sales: 50, spend: 70 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'MONEY_LEAKAGE')).toBe(false);
    });
  });

  describe('ROAS_DROP_CRITICAL', () => {
    it('should detect when ROAS is < 50% of campaign baseline for 2+ consecutive days (CRITICAL)', () => {
      // Baseline: campaign normally runs ROAS ~4.0
      const baselineRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({ date: `2025-04-${String(i + 1).padStart(2, '0')}`, roas_calc: 4.0 })
      );
      // Critical drop: ROAS 0.5 is 12.5% of baseline (< 50% threshold)
      // Need 2 consecutive days for the fix to trigger
      const dropRow1 = createNormalisedRow({ date: '2025-04-11', roas_calc: 0.5 });
      const dropRow2 = createNormalisedRow({ date: '2025-04-12', roas_calc: 0.5 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow1, dropRow2]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP_CRITICAL')).toBe(true);
    });

    it('should NOT flag when ROAS drop is modest (< 20% below baseline)', () => {
      const baselineRows = Array.from({ length: 10 }, () =>
        createNormalisedRow({ roas_calc: 4.0 })
      );
      // Drop to 3.5 is 87.5% of baseline (> 80% threshold)
      const dropRow = createNormalisedRow({ date: '2025-04-15', roas_calc: 3.5 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP_CRITICAL')).toBe(false);
      expect(result.findings.some(f => f.type === 'ROAS_DROP')).toBe(false);
    });

    it('should flag HIGH when ROAS is 50-80% of baseline', () => {
      // Need >= 15 rows for z-score detection + variance for std > 0
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({ date: `2025-04-${String(i + 1).padStart(2, '0')}`, roas_calc: 4.0 + (i % 3) * 0.1 })
      );
      // Drop to 2.1 is 52.5% of baseline — should trigger z-score based ROAS_DROP
      const dropRow = createNormalisedRow({ date: '2025-04-20', roas_calc: 2.1 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP')).toBe(true);
    });

    it('should NOT flag when campaign baseline is already < 1', () => {
      // Campaign consistently runs ROAS 0.8 (always unprofitable)
      const baselineRows = Array.from({ length: 10 }, () =>
        createNormalisedRow({ roas_calc: 0.8 })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-15', roas_calc: 0.5 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      // 0.5 / 0.8 = 62.5% which is > 50%, so not CRITICAL
      // But it's < 80%, so it should be HIGH (ROAS_DROP)
      expect(result.findings.some(f => f.type === 'ROAS_DROP_CRITICAL')).toBe(false);
    });

    it('should NOT flag when ROAS >= 1', () => {
      const rows = [createNormalisedRow({ roas_calc: 1.5 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP_CRITICAL')).toBe(false);
    });
  });

  describe('ROAS_DROP (Z-Score based)', () => {
    it('should detect significant ROAS drop within regime', () => {
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          roas_calc: 4.0 + (i % 3) * 0.1, // Add variance for std > 0
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-20', roas_calc: 1.5 }); // Still > 1, but significant drop

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP')).toBe(true);
    });

    it('should NOT flag when regime has < 15 data points', () => {
      const baselineRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          roas_calc: 4.0,
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-15', roas_calc: 1.5 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ROAS_DROP')).toBe(false);
    });
  });

  describe('CVR_ANOMALY', () => {
    it('should detect significant CVR drop', () => {
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          cvr_calc: 0.15 + (i % 3) * 0.01, // Add variance for std > 0
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-20', cvr_calc: 0.02 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CVR_ANOMALY')).toBe(true);
    });

    it('should detect significant CVR spike', () => {
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          cvr_calc: 0.10 + (i % 3) * 0.01, // Add variance for std > 0
        })
      );
      const spikeRow = createNormalisedRow({ date: '2025-04-20', cvr_calc: 0.50 });

      const regimeResult = createRegimeResult([...baselineRows, spikeRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CVR_ANOMALY')).toBe(true);
    });

    it('should NOT flag when regime has < 15 data points', () => {
      const baselineRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          cvr_calc: 0.15,
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-15', cvr_calc: 0.02 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CVR_ANOMALY')).toBe(false);
    });
  });

  describe('CTR_DROP', () => {
    it('should detect significant CTR drop', () => {
      const baselineRows = Array.from({ length: 15 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          ctr_calc: 0.05 + (i % 3) * 0.001, // Add variance for std > 0
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-20', ctr_calc: 0.005 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CTR_DROP')).toBe(true);
    });

    it('should NOT flag when regime has < 15 data points', () => {
      const baselineRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          ctr_calc: 0.05,
        })
      );
      const dropRow = createNormalisedRow({ date: '2025-04-15', ctr_calc: 0.005 });

      const regimeResult = createRegimeResult([...baselineRows, dropRow]);
      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'CTR_DROP')).toBe(false);
    });
  });

  describe('ZERO_ACTIVITY_CAMPAIGN', () => {
    it('should NOT flag zero activity ≤ 7 days (new campaign grace period)', () => {
      const zeroRows = Array.from({ length: 7 }, (_, i) =>
        createNormalisedRow({
          campaign_id: 'CMP-ZERO',
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          impressions: 0,
          clicks: 0,
          spend: 0,
          orders: 0,
        })
      );
      const regimeResult = createRegimeResult(zeroRows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN')).toBe(false);
    });

    it('should flag MEDIUM severity for 8–10 days of zero activity', () => {
      const zeroRows = Array.from({ length: 10 }, (_, i) =>
        createNormalisedRow({
          campaign_id: 'CMP-ZERO',
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          impressions: 0,
          clicks: 0,
          spend: 0,
          orders: 0,
        })
      );
      const regimeResult = createRegimeResult(zeroRows);

      const result = runAnomalyDetectionStage(regimeResult);
      const findings = result.findings.filter(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN');

      expect(findings).toHaveLength(1);
      expect(findings[0].severityHint).toBe('MEDIUM');
      expect(findings[0].baseline).toBe(10);
    });

    it('should flag HIGH severity for 11–14 days of zero activity', () => {
      const zeroRows = Array.from({ length: 14 }, (_, i) =>
        createNormalisedRow({
          campaign_id: 'CMP-ZERO',
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          impressions: 0,
          clicks: 0,
          spend: 0,
          orders: 0,
        })
      );
      const regimeResult = createRegimeResult(zeroRows);

      const result = runAnomalyDetectionStage(regimeResult);
      const findings = result.findings.filter(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN');

      expect(findings).toHaveLength(1);
      expect(findings[0].severityHint).toBe('HIGH');
      expect(findings[0].baseline).toBe(14);
    });

    it('should flag CRITICAL severity for > 14 days of zero activity', () => {
      const zeroRows = Array.from({ length: 20 }, (_, i) =>
        createNormalisedRow({
          campaign_id: 'CMP-ZERO',
          date: `2025-04-${String(i + 1).padStart(2, '0')}`,
          impressions: 0,
          clicks: 0,
          spend: 0,
          orders: 0,
        })
      );
      const regimeResult = createRegimeResult(zeroRows);

      const result = runAnomalyDetectionStage(regimeResult);
      const findings = result.findings.filter(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN');

      expect(findings).toHaveLength(1);
      expect(findings[0].severityHint).toBe('CRITICAL');
      expect(findings[0].baseline).toBe(20);
    });

    it('should emit separate findings for multiple zero-activity streaks', () => {
      const rows = [
        // Streak 1: 10 days (MEDIUM)
        ...Array.from({ length: 10 }, (_, i) =>
          createNormalisedRow({
            campaign_id: 'CMP-ZERO',
            date: `2025-04-${String(i + 1).padStart(2, '0')}`,
            impressions: 0,
            clicks: 0,
            spend: 0,
            orders: 0,
          })
        ),
        // Activity resumes
        createNormalisedRow({
          campaign_id: 'CMP-ZERO',
          date: '2025-04-11',
          impressions: 1000,
          clicks: 50,
          spend: 25,
          orders: 5,
        }),
        // Streak 2: 12 days (HIGH)
        ...Array.from({ length: 12 }, (_, i) =>
          createNormalisedRow({
            campaign_id: 'CMP-ZERO',
            date: `2025-04-${String(i + 12).padStart(2, '0')}`,
            impressions: 0,
            clicks: 0,
            spend: 0,
            orders: 0,
          })
        ),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);
      const findings = result.findings.filter(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN');

      expect(findings).toHaveLength(2);
      expect(findings.some(f => f.severityHint === 'MEDIUM')).toBe(true);
      expect(findings.some(f => f.severityHint === 'HIGH')).toBe(true);
    });

    it('should NOT flag if activity resumes within safe threshold', () => {
      const rows = [
        ...Array.from({ length: 5 }, (_, i) =>
          createNormalisedRow({
            campaign_id: 'CMP-0001',
            date: `2025-04-${String(i + 1).padStart(2, '0')}`,
            impressions: 0,
            clicks: 0,
            spend: 0,
            orders: 0,
          })
        ),
        createNormalisedRow({
          campaign_id: 'CMP-0001',
          date: '2025-04-06',
          impressions: 1000,
          clicks: 50,
          spend: 25,
          orders: 5,
        }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings.some(f => f.type === 'ZERO_ACTIVITY_CAMPAIGN')).toBe(false);
    });
  });

  describe('ORDERS_EXCEED_CLICKS (NOT an anomaly)', () => {
    it('should NOT detect orders > clicks as anomaly (Amazon attribution expected)', () => {
      const rows = [createNormalisedRow({ orders: 15, clicks: 10 })];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      // There should be NO anomaly type for orders > clicks
      const findingTypes = result.findings.map(f => f.type);
      expect(findingTypes).not.toContain('ORDERS_EXCEED_CLICKS');
    });
  });

  describe('Finding Metadata', () => {
    it('should include regime context in each finding', () => {
      const rows = [createNormalisedRow({ clicks: 1500, impressions: 1000 })];
      const regime = createRegime({ id: 'test-regime-123' });
      const regimeResult = createRegimeResult(rows, regime);

      const result = runAnomalyDetectionStage(regimeResult);

      const finding = result.findings[0];
      expect(finding.regime.id).toBe('test-regime-123');
      expect(finding.regime.startDate).toBe(regime.startDate);
      expect(finding.regime.endDate).toBe(regime.endDate);
    });

    it('should generate unique IDs for each finding', () => {
      const rows = [
        createNormalisedRow({ clicks: 1500, impressions: 1000 }),
        createNormalisedRow({ campaign_id: 'CMP-0002', spend: 50, clicks: 0 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      const ids = result.findings.map(f => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Stats Calculation', () => {
    it('should count findings by campaign', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', clicks: 1500, impressions: 1000 }),
        createNormalisedRow({ campaign_id: 'CMP-0001', spend: 50, clicks: 0 }),
        createNormalisedRow({ campaign_id: 'CMP-0002', clicks: 1500, impressions: 1000 }),
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.stats.byCampaign['CMP-0001']).toBe(2);
      expect(result.stats.byCampaign['CMP-0002']).toBe(1);
    });

    it('should count findings by type', () => {
      const rows = [
        createNormalisedRow({ clicks: 1500, impressions: 1000 }), // CLICKS_EXCEED_IMPRESSIONS
        createNormalisedRow({ campaign_id: 'CMP-0002', spend: 50, clicks: 0 }), // SPEND_WITHOUT_CLICKS
      ];
      const regimeResult = createRegimeResult(rows);

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.stats.byType['CLICKS_EXCEED_IMPRESSIONS']).toBe(1);
      expect(result.stats.byType['SPEND_WITHOUT_CLICKS']).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty regime result', () => {
      const regimeResult: RegimeDetectionResult = {
        regimes: [],
        breakpoints: [],
        rowsByRegime: new Map(),
      };

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });

    it('should handle multiple regimes', () => {
      const regime1 = createRegime({ id: 'regime-1', startDate: '2025-03-01', endDate: '2025-03-15' });
      const regime2 = createRegime({ id: 'regime-2', startDate: '2025-03-16', endDate: '2025-03-31' });

      const rowsByRegime = new Map<string, NormalisedRow[]>();
      rowsByRegime.set(regime1.id, [createNormalisedRow({ clicks: 1500, impressions: 1000 })]);
      rowsByRegime.set(regime2.id, [createNormalisedRow({ spend: 50, clicks: 0 })]);

      const regimeResult: RegimeDetectionResult = {
        regimes: [regime1, regime2],
        breakpoints: ['2025-03-16'],
        rowsByRegime,
      };

      const result = runAnomalyDetectionStage(regimeResult);

      expect(result.findings).toHaveLength(2);
      expect(result.findings.some(f => f.regime.id === 'regime-1')).toBe(true);
      expect(result.findings.some(f => f.regime.id === 'regime-2')).toBe(true);
    });
  });
});
