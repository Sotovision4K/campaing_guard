import { describe, it, expect } from 'vitest';
import { runRegimeDetectionStage } from '../regime-detection.stage';
import { NormalisedRow } from '../../../interfaces/pipeline.interface';

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

function generateDateSequence(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

describe('Regime Detection Stage', () => {
  describe('Single Regime Detection', () => {
    it('should return single regime when no significant spend change detected', () => {
      const dates = generateDateSequence('2025-03-01', 30);
      const rows = dates.map(date => createNormalisedRow({
        date,
        spend: 25 + Math.random() * 5, // slight variation, ~25
      }));

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes).toHaveLength(1);
      expect(result.breakpoints).toHaveLength(0);
    });

    it('should calculate regime stats correctly', () => {
      const rows = [
        createNormalisedRow({ date: '2025-04-01', spend: 100, impressions: 5000 }),
        createNormalisedRow({ date: '2025-04-02', spend: 120, impressions: 6000 }),
        createNormalisedRow({ date: '2025-04-03', spend: 110, impressions: 5500 }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].stats.avgSpend).toBeCloseTo(110); // (100+120+110)/3
      expect(result.regimes[0].stats.avgImpressions).toBeCloseTo(5500);
    });

    it('should set correct date range for single regime', () => {
      const rows = [
        createNormalisedRow({ date: '2025-03-01' }),
        createNormalisedRow({ date: '2025-03-15' }),
        createNormalisedRow({ date: '2025-03-30' }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].startDate).toBe('2025-03-01');
      expect(result.regimes[0].endDate).toBe('2025-03-30');
    });

    it('should include all unique campaign IDs in regime', () => {
      const rows = [
        createNormalisedRow({ campaign_id: 'CMP-0001', date: '2025-04-01' }),
        createNormalisedRow({ campaign_id: 'CMP-0002', date: '2025-04-01' }),
        createNormalisedRow({ campaign_id: 'CMP-0003', date: '2025-04-01' }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].campaignIds).toContain('CMP-0001');
      expect(result.regimes[0].campaignIds).toContain('CMP-0002');
      expect(result.regimes[0].campaignIds).toContain('CMP-0003');
    });
  });

  describe('Multiple Regime Detection (Breakpoint)', () => {
    it('should detect breakpoint when significant spend increase occurs', () => {
      // Simulate DATA_AUDIT scenario: spend spikes after 2025-04-26
      const beforeBreak = generateDateSequence('2025-04-01', 25).map(date =>
        createNormalisedRow({ date, spend: 25 }) // normal spend
      );
      const afterBreak = generateDateSequence('2025-04-26', 10).map(date =>
        createNormalisedRow({ date, spend: 100 }) // 4x increase
      );

      const result = runRegimeDetectionStage([...beforeBreak, ...afterBreak]);

      expect(result.regimes.length).toBeGreaterThanOrEqual(2);
      expect(result.breakpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should correctly assign rows to their respective regimes', () => {
      const regime1Rows = [
        createNormalisedRow({ date: '2025-04-01', spend: 20 }),
        createNormalisedRow({ date: '2025-04-02', spend: 22 }),
      ];
      const regime2Rows = [
        createNormalisedRow({ date: '2025-04-26', spend: 100 }),
        createNormalisedRow({ date: '2025-04-27', spend: 110 }),
      ];

      const result = runRegimeDetectionStage([...regime1Rows, ...regime2Rows]);

      // Verify rowsByRegime map has correct assignments
      const allMappedRows = Array.from(result.rowsByRegime.values()).flat();
      expect(allMappedRows).toHaveLength(4);
    });

    it('should label regimes appropriately', () => {
      const normalRows = generateDateSequence('2025-03-01', 10).map(date =>
        createNormalisedRow({ date, spend: 25 })
      );
      const highSpendRows = generateDateSequence('2025-03-15', 10).map(date =>
        createNormalisedRow({ date, spend: 150 })
      );

      const result = runRegimeDetectionStage([...normalRows, ...highSpendRows]);

      const regimeTypes = result.regimes.map(r => r.type);
      expect(regimeTypes).toContain('high_spend');
    });
  });

  describe('Regime Stats Calculation', () => {
    it('should calculate standard deviation for spend', () => {
      const rows = [
        createNormalisedRow({ date: '2025-04-01', spend: 10 }),
        createNormalisedRow({ date: '2025-04-02', spend: 20 }),
        createNormalisedRow({ date: '2025-04-03', spend: 30 }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].stats.stdSpend).toBeGreaterThan(0);
    });

    it('should handle regime with zero variance (all same values)', () => {
      const rows = [
        createNormalisedRow({ date: '2025-04-01', spend: 100 }),
        createNormalisedRow({ date: '2025-04-02', spend: 100 }),
        createNormalisedRow({ date: '2025-04-03', spend: 100 }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].stats.stdSpend).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input array', () => {
      const result = runRegimeDetectionStage([]);

      expect(result.regimes).toHaveLength(0);
      expect(result.breakpoints).toHaveLength(0);
      expect(result.rowsByRegime.size).toBe(0);
    });

    it('should handle single row', () => {
      const rows = [createNormalisedRow({ date: '2025-04-15' })];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes).toHaveLength(1);
      expect(result.regimes[0].startDate).toBe('2025-04-15');
      expect(result.regimes[0].endDate).toBe('2025-04-15');
    });

    it('should handle unsorted dates', () => {
      const rows = [
        createNormalisedRow({ date: '2025-04-15' }),
        createNormalisedRow({ date: '2025-04-01' }),
        createNormalisedRow({ date: '2025-04-30' }),
      ];

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes[0].startDate).toBe('2025-04-01');
      expect(result.regimes[0].endDate).toBe('2025-04-30');
    });

    it('should generate unique regime IDs', () => {
      const beforeBreak = generateDateSequence('2025-04-01', 10).map(date =>
        createNormalisedRow({ date, spend: 25 })
      );
      const afterBreak = generateDateSequence('2025-04-15', 10).map(date =>
        createNormalisedRow({ date, spend: 200 })
      );

      const result = runRegimeDetectionStage([...beforeBreak, ...afterBreak]);

      const regimeIds = result.regimes.map(r => r.id);
      const uniqueIds = new Set(regimeIds);
      expect(uniqueIds.size).toBe(regimeIds.length);
    });
  });

  describe('Low Activity Detection', () => {
    it('should label regime as low_activity when metrics are near zero', () => {
      const rows = generateDateSequence('2025-04-01', 10).map(date =>
        createNormalisedRow({
          date,
          spend: 0,
          impressions: 0,
          clicks: 0,
        })
      );

      const result = runRegimeDetectionStage(rows);

      expect(result.regimes.some(r => r.type === 'low_activity')).toBe(true);
    });
  });
});
