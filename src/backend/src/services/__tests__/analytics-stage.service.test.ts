import { describe, it, expect } from 'vitest';
import { validateRow } from '../analytics-stage.service';
import type { ValidationResult, ValidationError } from '../../interfaces/csv-row.interface.js';

describe('AnalyticsStageService - Row Validation', () => {
  describe('validateRow', () => {
    it('should return valid result for a valid row', () => {
      const validRow = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(validRow, 0);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should flag row with missing campaign_id', () => {
      const row = {
        campaign_id: '',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_CAMPAIGN_ID')).toBe(true);
    });

    it('should flag row with missing campaign_id when undefined', () => {
      const row = {
        campaign_id: undefined as unknown as string,
        date: '2024-01-15',
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_CAMPAIGN_ID')).toBe(true);
    });

    it('should flag row with invalid date format', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '01-15-2024',
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DATE')).toBe(true);
    });

    it('should flag row with invalid date when null', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: null as unknown as string,
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DATE')).toBe(true);
    });

    it('should flag row when clicks is not numeric (string)', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 'abc' as unknown as number,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CLICKS_NOT_NUMERIC')).toBe(true);
    });

    it('should flag row when clicks is not numeric (NaN)', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: NaN,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CLICKS_NOT_NUMERIC')).toBe(true);
    });

    it('should flag row with negative spend', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 500,
        spend: -50.00,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_SPEND')).toBe(true);
    });

    it('should flag row when clicks exceed impressions', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 100,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CLICKS_EXCEED_IMPRESSIONS')).toBe(true);
    });

    it('should flag row with clicks equal to impressions (edge case - should be valid)', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 500,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(true);
      expect(result.errors.some(e => e.code === 'CLICKS_EXCEED_IMPRESSIONS')).toBe(false);
    });

    it('should capture multiple errors in a single row', () => {
      const row = {
        campaign_id: '',
        date: 'invalid-date',
        impressions: 10000,
        clicks: 'not-numeric' as unknown as number,
        spend: -100.00,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 5);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some(e => e.code === 'MISSING_CAMPAIGN_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_DATE')).toBe(true);
      expect(result.errors.some(e => e.code === 'CLICKS_NOT_NUMERIC')).toBe(true);
      expect(result.errors.some(e => e.code === 'NEGATIVE_SPEND')).toBe(true);
    });

    it('should include rowIndex in all error entries', () => {
      const row = {
        campaign_id: '',
        date: 'invalid-date',
        impressions: 10000,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 42);

      result.errors.forEach(error => {
        expect(error.rowIndex).toBe(42);
      });
    });

    it('should return empty errors array for valid row', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 500,
        spend: 0,
        orders: 0,
        sales: 0,
        acos: 0,
        cpc: 0,
        ctr: 0,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should flag row with negative impressions', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: -100,
        clicks: 500,
        spend: 100.50,
        orders: 25,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'NEGATIVE_IMPRESSIONS')).toBe(true);
    });

    it('should flag row with zero impressions (edge case - consider if valid)', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 0,
        clicks: 0,
        spend: 0,
        orders: 0,
        sales: 0,
        acos: 0,
        cpc: 0,
        ctr: 0,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(true);
    });

    it('should flag row when orders exceed clicks', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 10,
        spend: 100.50,
        orders: 50,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'ORDERS_EXCEED_CLICKS')).toBe(true);
    });

    it('should flag row when orders equal clicks (edge case - should be valid)', () => {
      const row = {
        campaign_id: 'CMP-001',
        date: '2024-01-15',
        impressions: 10000,
        clicks: 50,
        spend: 100.50,
        orders: 50,
        sales: 1250.00,
        acos: 0.08,
        cpc: 0.20,
        ctr: 0.05,
      };

      const result = validateRow(row, 0);

      expect(result.isValid).toBe(true);
      expect(result.errors.some(e => e.code === 'ORDERS_EXCEED_CLICKS')).toBe(false);
    });
  });
});