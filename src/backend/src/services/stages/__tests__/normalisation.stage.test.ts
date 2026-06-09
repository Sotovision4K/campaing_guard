import { describe, it, expect } from 'vitest';
import { runNormalisationStage } from '../normalisation.stage';
import { CSVRow } from '../../../interfaces/csv-row.interface';
import { NormalisedRow, NormalisationResult } from '../../../interfaces/pipeline.interface';

function createRow(overrides: Partial<CSVRow> = {}): CSVRow {
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
    ...overrides,
  };
}

describe('Normalisation Stage', () => {
  describe('ACoS Normalisation', () => {
    // Base createRow: spend=25, sales=100 → expected ACoS = (25/100)*100 = 25%

    it('should convert decimal ACoS to percentage when closer to expected', () => {
      // input 0.25 (decimal 25%) vs expected 25%
      const rows = [createRow({ acos: 0.25 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(25);
      expect(result.rows[0]._acosWasPercent).toBe(false);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should keep percentage ACoS when closer to expected', () => {
      // input 73 (73%) vs expected 25%
      const rows = [createRow({ acos: 73 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(73);
      expect(result.rows[0]._acosWasPercent).toBe(true);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should handle high but legitimate ACoS values (up to 500%)', () => {
      // input 450 (450%) vs expected 25%
      const rows = [createRow({ acos: 450 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(450);
      expect(result.rows[0]._acosWasPercent).toBe(true);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should flag ACoS > 500 as an anomaly', () => {
      const rows = [createRow({ acos: 600 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(600);
      expect(result.rows[0]._acosIsAnomaly).toBe(true);
    });

    it('should handle ACoS exactly at 500 boundary', () => {
      const rows = [createRow({ acos: 500 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(500);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should detect decimal ACoS that exceeds 500% when converted', () => {
      // spend=600, sales=100 → expected = 600%
      // input 6.0 (decimal = 600%) is much closer to 600 than 6 (percent = 6%)
      const rows = [createRow({ spend: 600, sales: 100, acos: 6.0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(600);
      expect(result.rows[0]._acosWasPercent).toBe(false);
      expect(result.rows[0]._acosIsAnomaly).toBe(true);
    });

    it('should compute expected ACoS from spend and sales to decide format', () => {
      // spend=150, sales=100 → expected = 150%
      // input 1.5 (decimal = 150%) is closer to 150 than 150 (percent = 150%)
      // Actually both give the same value, but wasPercent should be false
      const rows = [createRow({ spend: 150, sales: 100, acos: 1.5 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(150);
      expect(result.rows[0]._acosWasPercent).toBe(false);
    });

    it('should handle ACoS of 0', () => {
      const rows = [createRow({ acos: 0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBe(0);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should handle sales=0 and spend=0 edge case', () => {
      const rows = [createRow({ sales: 0, spend: 0, acos: 0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBe(0);
      expect(result.rows[0]._acosIsAnomaly).toBe(false);
    });

    it('should flag anomaly when sales=0 but spend>0', () => {
      const rows = [createRow({ sales: 0, spend: 50, acos: 100 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0]._acosIsAnomaly).toBe(true);
    });

    it('should handle mixed ACoS formats in same dataset', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', acos: 0.25 }),              // expected 25, decimal closer → 25%
        createRow({ campaign_id: 'CMP-0002', acos: 73 }),                // expected 25, percent closer → 73%
        createRow({ campaign_id: 'CMP-0003', spend: 30, sales: 100, acos: 0.30 }), // expected 30, decimal closer → 30%
      ];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].acos_normalised).toBeCloseTo(25);
      expect(result.rows[1].acos_normalised).toBeCloseTo(73);
      expect(result.rows[2].acos_normalised).toBeCloseTo(30);
      expect(result.stats.acosNormalised).toBe(1); // only CMP-0002 was already in percent
    });
  });

  describe('Duplicate Removal', () => {
    it('should remove duplicates by (campaign_id, date), keeping LAST occurrence', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 10 }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 20 }), // duplicate, should keep this
        createRow({ campaign_id: 'CMP-0002', date: '2025-04-15', spend: 30 }),
      ];
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.find(r => r.campaign_id === 'CMP-0001')?.spend).toBe(20);
      expect(result.stats.duplicatesRemoved).toBe(1);
    });

    it('should handle multiple duplicates for same campaign/date', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 10 }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 20 }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 30 }), // keep this one
      ];
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].spend).toBe(30);
      expect(result.stats.duplicatesRemoved).toBe(2);
    });

    it('should mark duplicate rows with _wasDuplicate flag', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15' }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-16' }), // different date, not duplicate
      ];
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every(r => r._wasDuplicate === false)).toBe(true);
      expect(result.stats.duplicatesRemoved).toBe(0);
    });

    it('should handle duplicates across different campaigns correctly', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 10 }),
        createRow({ campaign_id: 'CMP-0003', date: '2025-04-15', spend: 15 }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15', spend: 20 }), // CMP-0001 duplicate
        createRow({ campaign_id: 'CMP-0003', date: '2025-04-15', spend: 25 }), // CMP-0003 duplicate
      ];
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.find(r => r.campaign_id === 'CMP-0001')?.spend).toBe(20);
      expect(result.rows.find(r => r.campaign_id === 'CMP-0003')?.spend).toBe(25);
      expect(result.stats.duplicatesRemoved).toBe(2);
    });
  });

  describe('Metric Recalculation', () => {
    it('should calculate CTR as clicks / impressions', () => {
      const rows = [createRow({ clicks: 100, impressions: 2000 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].ctr_calc).toBeCloseTo(0.05); // 100/2000
    });

    it('should calculate CVR as orders / clicks', () => {
      const rows = [createRow({ orders: 10, clicks: 100 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].cvr_calc).toBeCloseTo(0.10); // 10/100
    });

    it('should calculate ROAS as sales / spend', () => {
      const rows = [createRow({ sales: 500, spend: 100 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].roas_calc).toBeCloseTo(5.0); // 500/100
    });

    it('should handle zero impressions for CTR (avoid division by zero)', () => {
      const rows = [createRow({ clicks: 0, impressions: 0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].ctr_calc).toBe(0);
    });

    it('should handle zero clicks for CVR (avoid division by zero)', () => {
      const rows = [createRow({ orders: 0, clicks: 0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].cvr_calc).toBe(0);
    });

    it('should handle zero spend for ROAS (avoid division by zero)', () => {
      const rows = [createRow({ sales: 0, spend: 0 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].roas_calc).toBe(0);
    });
  });

  describe('Stats Tracking', () => {
    it('should correctly track input and output counts', () => {
      const rows = [
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15' }),
        createRow({ campaign_id: 'CMP-0001', date: '2025-04-15' }), // duplicate
        createRow({ campaign_id: 'CMP-0002', date: '2025-04-15' }),
      ];
      const result = runNormalisationStage(rows);

      expect(result.stats.inputCount).toBe(3);
      expect(result.stats.outputCount).toBe(2);
      expect(result.stats.duplicatesRemoved).toBe(1);
    });
  });

  describe('Orders > Clicks Handling', () => {
    it('should NOT flag or modify rows where orders > clicks (Amazon attribution)', () => {
      const rows = [createRow({ orders: 15, clicks: 10 })]; // orders > clicks is EXPECTED
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].orders).toBe(15);
      expect(result.rows[0].clicks).toBe(10);
      // CVR calculation should still work (will be > 1, which is fine)
      expect(result.rows[0].cvr_calc).toBeCloseTo(1.5); // 15/10
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input array', () => {
      const result = runNormalisationStage([]);

      expect(result.rows).toHaveLength(0);
      expect(result.stats.inputCount).toBe(0);
      expect(result.stats.outputCount).toBe(0);
    });

    it('should handle single row', () => {
      const rows = [createRow()];
      const result = runNormalisationStage(rows);

      expect(result.rows).toHaveLength(1);
      expect(result.stats.duplicatesRemoved).toBe(0);
    });

    it('should preserve all original fields', () => {
      const rows = [createRow({ campaign_id: 'TEST-123', sales: 999.99 })];
      const result = runNormalisationStage(rows);

      expect(result.rows[0].campaign_id).toBe('TEST-123');
      expect(result.rows[0].sales).toBe(999.99);
    });
  });
});
