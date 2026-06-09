import { describe, it, expect } from 'vitest';
import { parseAndValidate } from '../analytics-stage.service';

describe('AnalyticsStageService - parseAndValidate', () => {
  const validCSV = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr
CMP-001,2024-01-15,10000,500,100.50,25,1250.00,0.08,0.20,0.05
CMP-002,2024-01-16,8000,400,80.00,20,1000.00,0.08,0.20,0.05`;

  const csvWithInvalidRows = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr
CMP-001,2024-01-15,10000,500,100.50,25,1250.00,0.08,0.20,0.05
,2024-01-16,8000,400,80.00,20,1000.00,0.08,0.20,0.05
CMP-003,invalid-date,8000,400,80.00,20,1000.00,0.08,0.20,0.05`;

  const emptyCSV = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr`;

  const malformedCSV = `this is not a csv file
just some random text`;

  describe('parseAndValidate', () => {
    it('should parse valid CSV and return all rows as valid', () => {
      const buffer = Buffer.from(validCSV);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.rows).toHaveLength(2);
      expect(result.validRows).toHaveLength(2);
      expect(result.invalidRows).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse CSV with first row data correctly', () => {
      const buffer = Buffer.from(validCSV);
      const result = parseAndValidate(buffer);

      expect(result.validRows[0].campaign_id).toBe('CMP-001');
      expect(result.validRows[0].date).toBe('2024-01-15');
      expect(result.validRows[0].impressions).toBe(10000);
      expect(result.validRows[0].clicks).toBe(500);
      expect(result.validRows[0].spend).toBe(100.50);
      expect(result.validRows[0].orders).toBe(25);
      expect(result.validRows[0].sales).toBe(1250.00);
    });

    it('should separate valid and invalid rows', () => {
      const buffer = Buffer.from(csvWithInvalidRows);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(3);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.validRows).toHaveLength(1);
      expect(result.invalidRows).toHaveLength(2);
    });

    it('should include validation errors for invalid rows', () => {
      const buffer = Buffer.from(csvWithInvalidRows);
      const result = parseAndValidate(buffer);

      const missingCampaignRow = result.invalidRows.find(
        r => r.errors.some(e => e.code === 'MISSING_CAMPAIGN_ID')
      );
      expect(missingCampaignRow).toBeDefined();

      const invalidDateRow = result.invalidRows.find(
        r => r.errors.some(e => e.code === 'INVALID_DATE')
      );
      expect(invalidDateRow).toBeDefined();
    });

    it('should handle empty CSV (headers only)', () => {
      const buffer = Buffer.from(emptyCSV);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(0);
      expect(result.validCount).toBe(0);
      expect(result.rows).toHaveLength(0);
    });

    it('should handle malformed CSV', () => {
      const buffer = Buffer.from(malformedCSV);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from('');
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should convert string numbers to numeric values', () => {
      const buffer = Buffer.from(validCSV);
      const result = parseAndValidate(buffer);

      expect(typeof result.validRows[0].impressions).toBe('number');
      expect(typeof result.validRows[0].clicks).toBe('number');
      expect(typeof result.validRows[0].spend).toBe('number');
    });

    it('should handle CSV with Windows line endings (CRLF)', () => {
      const windowsCSV = validCSV.replace(/\n/g, '\r\n');
      const buffer = Buffer.from(windowsCSV);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
    });

    it('should trim whitespace from values', () => {
      const csvWithSpaces = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr
  CMP-001  ,2024-01-15,10000,500,100.50,25,1250.00,0.08,0.20,0.05`;
      const buffer = Buffer.from(csvWithSpaces);
      const result = parseAndValidate(buffer);

      expect(result.validRows[0].campaign_id).toBe('CMP-001');
    });

    it('should handle missing columns gracefully', () => {
      const incompleteCSV = `campaign_id,date,impressions
CMP-001,2024-01-15,10000`;
      const buffer = Buffer.from(incompleteCSV);
      const result = parseAndValidate(buffer);

      expect(result.success).toBe(true);
      expect(result.invalidCount).toBeGreaterThan(0);
    });
  });
});