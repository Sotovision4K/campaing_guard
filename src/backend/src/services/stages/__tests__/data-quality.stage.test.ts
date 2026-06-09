import { describe, it, expect } from 'vitest';
import { runDataQualityStage } from '../data-quality.stage';
import { DataQualityResult } from '../../../interfaces/pipeline.interface';

// Test fixtures
const VALID_CSV_HEADERS = 'campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr';

function createCSVBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

function createValidRow(overrides: Partial<Record<string, string | number>> = {}): string {
  const defaults = {
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
  };
  const row = { ...defaults, ...overrides };
  return Object.values(row).join(',');
}

describe('Data Quality Stage', () => {
  describe('Critical Errors - Pipeline Halts', () => {
    it('should return EMPTY_FILE error for empty buffer', () => {
      const buffer = createCSVBuffer('');
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('EMPTY_FILE');
      expect(result.rows).toHaveLength(0);
    });

    it('should return EMPTY_FILE error for whitespace-only content', () => {
      const buffer = createCSVBuffer('   \n\n   ');
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('EMPTY_FILE');
    });

    it('should return MISSING_HEADERS error when all headers are missing', () => {
      const buffer = createCSVBuffer('foo,bar,baz\n1,2,3');
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('MISSING_HEADERS');
      expect(result.criticalError?.details?.missing).toContain('campaign_id');
      expect(result.criticalError?.details?.missing).toContain('date');
    });

    it('should return MISSING_HEADERS error when required headers are missing', () => {
      const buffer = createCSVBuffer('campaign_id,date,foo\nCMP-0001,2025-04-15,bar');
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('MISSING_HEADERS');
      expect(result.criticalError?.details?.missing).toContain('impressions');
      expect(result.criticalError?.details?.missing).toContain('clicks');
    });

    it('should return INSUFFICIENT_VALID_ROWS when <50% rows are valid', () => {
      const rows = [
        VALID_CSV_HEADERS,
        ',2025-04-15,1000,50,25,5,100,0.25,0.5,0.05', // missing campaign_id
        ',2025-04-16,1000,50,25,5,100,0.25,0.5,0.05', // missing campaign_id
        ',2025-04-17,1000,50,25,5,100,0.25,0.5,0.05', // missing campaign_id
        createValidRow({ campaign_id: 'CMP-0001', date: '2025-04-18' }), // valid
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('INSUFFICIENT_VALID_ROWS');
      expect(result.criticalError?.details?.validCount).toBe(1);
      expect(result.criticalError?.details?.totalCount).toBe(4);
    });
  });

  describe('Successful Validation', () => {
    it('should return success with valid CSV data', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ campaign_id: 'CMP-0001', date: '2025-04-15' }),
        createValidRow({ campaign_id: 'CMP-0002', date: '2025-04-15' }),
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.criticalError).toBeUndefined();
      expect(result.rows).toHaveLength(2);
    });

    it('should parse numeric fields correctly', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ impressions: 5000, clicks: 250, spend: 125.50 }),
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows[0].impressions).toBe(5000);
      expect(result.rows[0].clicks).toBe(250);
      expect(result.rows[0].spend).toBe(125.50);
    });

    it('should handle headers case-insensitively', () => {
      const rows = [
        'Campaign_ID,DATE,Impressions,CLICKS,Spend,Orders,Sales,ACoS,CPC,CTR,CVR,ROAS',
        createValidRow(),
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Row-Level Validation (Non-Critical)', () => {
    it('should filter out rows with empty campaign_id but continue processing', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ campaign_id: 'CMP-0001' }),
        ',2025-04-16,1000,50,25,5,100,0.25,0.5,0.05', // empty campaign_id
        createValidRow({ campaign_id: 'CMP-0002' }),
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].field).toBe('campaign_id');
    });

    it('should filter out rows with invalid date format', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ date: '2025-04-15' }), // valid
        createValidRow({ campaign_id: 'CMP-0004', date: '2025-04-16' }), // valid
        createValidRow({ campaign_id: 'CMP-0005', date: '2025-04-17' }), // valid
        'CMP-0002,15-04-2025,1000,50,25,5,100,0.25,0.5,0.05', // invalid date format
        'CMP-0003,2025/04/15,1000,50,25,5,100,0.25,0.5,0.05', // invalid date format
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(3);
      expect(result.warnings.filter(w => w.field === 'date')).toHaveLength(2);
    });

    it('should filter out rows with negative spend', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ spend: 25 }),
        createValidRow({ campaign_id: 'CMP-0002', spend: -10 }), // negative spend
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.some(w => w.field === 'spend')).toBe(true);
    });

    it('should filter out rows with negative impressions', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ impressions: 1000 }),
        createValidRow({ campaign_id: 'CMP-0002', impressions: -500 }), // negative
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it('should filter out rows where clicks exceed impressions', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ impressions: 1000, clicks: 50 }), // valid
        'CMP-0002,2025-04-16,100,500,25,5,100,0.25,0.5,0.05', // clicks > impressions
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.some(w => w.field === 'clicks')).toBe(true);
    });

    it('should NOT filter out rows where orders exceed clicks (Amazon attribution)', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow({ clicks: 10, orders: 15 }), // orders > clicks is ALLOWED
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].orders).toBe(15);
      expect(result.rows[0].clicks).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle CSV with only headers', () => {
      const buffer = createCSVBuffer(VALID_CSV_HEADERS);
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(false);
      expect(result.criticalError?.code).toBe('EMPTY_FILE');
    });

    it('should handle quoted values with commas', () => {
      const rows = [
        VALID_CSV_HEADERS,
        '"CMP-0001","2025-04-15",1000,50,25,5,100,0.25,0.5,0.05',
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows[0].campaign_id).toBe('CMP-0001');
    });

    it('should handle Windows line endings (CRLF)', () => {
      const rows = [
        VALID_CSV_HEADERS,
        createValidRow(),
      ];
      const buffer = createCSVBuffer(rows.join('\r\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it('should skip empty lines', () => {
      const rows = [
        VALID_CSV_HEADERS,
        '',
        createValidRow({ campaign_id: 'CMP-0001' }),
        '',
        createValidRow({ campaign_id: 'CMP-0002' }),
        '',
      ];
      const buffer = createCSVBuffer(rows.join('\n'));
      const result = runDataQualityStage({ buffer });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
    });
  });
});
