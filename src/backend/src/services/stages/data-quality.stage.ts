import { CSVRow } from '../../interfaces/csv-row.interface';
import {
  DataQualityInput,
  DataQualityResult,
  CriticalError,
  Warning,
  CRITICAL_VALID_ROW_THRESHOLD,
} from '../../interfaces/pipeline.interface.js';

const CSV_HEADERS = [
  'campaign_id', 'date', 'impressions', 'clicks', 'spend',
  'orders', 'sales', 'acos', 'cpc', 'ctr'
] as const;

const NUMERIC_FIELDS = [
  'impressions', 'clicks', 'spend', 'orders', 'sales',
  'acos', 'cpc', 'ctr'
] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function rowToCSVRow(headers: string[], values: string[]): CSVRow {
  const row: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    const value = values[index] ?? '';
    const trimmedHeader = header.trim().toLowerCase();
    const trimmedValue = value.trim();

    if (NUMERIC_FIELDS.includes(trimmedHeader as typeof NUMERIC_FIELDS[number])) {
      const num = parseFloat(trimmedValue);
      row[trimmedHeader] = isNaN(num) ? NaN : num;
    } else {
      row[trimmedHeader] = trimmedValue;
    }
  });

  return row as unknown as CSVRow;
}

interface RowValidation {
  isValid: boolean;
  warnings: Warning[];
}

function validateRow(row: CSVRow, rowIndex: number): RowValidation {
  const warnings: Warning[] = [];

  // Campaign ID required
  if (!row.campaign_id || row.campaign_id.trim() === '') {
    warnings.push({
      rowIndex,
      field: 'campaign_id',
      message: 'Campaign ID is required and cannot be empty',
    });
  }

  // Date format validation
  if (!row.date || !isValidDate(row.date)) {
    warnings.push({
      rowIndex,
      field: 'date',
      message: 'Date must be in valid ISO 8601 format (YYYY-MM-DD)',
    });
  }

  // Numeric field validations
  if (typeof row.clicks !== 'number' || isNaN(row.clicks)) {
    warnings.push({
      rowIndex,
      field: 'clicks',
      message: 'Clicks must be a valid number',
    });
  }

  if (typeof row.spend === 'number' && row.spend < 0) {
    warnings.push({
      rowIndex,
      field: 'spend',
      message: 'Spend cannot be negative',
    });
  }

  if (typeof row.impressions === 'number' && row.impressions < 0) {
    warnings.push({
      rowIndex,
      field: 'impressions',
      message: 'Impressions cannot be negative',
    });
  }

  // Clicks cannot exceed impressions (data integrity)
  if (
    typeof row.clicks === 'number' &&
    typeof row.impressions === 'number' &&
    row.clicks > row.impressions
  ) {
    warnings.push({
      rowIndex,
      field: 'clicks',
      message: 'Clicks cannot exceed impressions',
    });
  }

  // NOTE: orders > clicks is NOT flagged - per DATA_AUDIT.md, this is expected Amazon behavior

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

export function runDataQualityStage(input: DataQualityInput): DataQualityResult {
  const content = input.buffer.toString('utf-8').trim();

  // Check for empty file
  if (!content) {
    return {
      success: false,
      rows: [],
      criticalError: {
        code: 'EMPTY_FILE',
        message: 'File is empty or contains only whitespace',
      },
      warnings: [],
    };
  }

  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  // Check for no data (only whitespace lines)
  if (lines.length === 0) {
    return {
      success: false,
      rows: [],
      criticalError: {
        code: 'EMPTY_FILE',
        message: 'File contains no data',
      },
      warnings: [],
    };
  }

  // Parse headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

  // Validate headers
  const requiredHeaders = CSV_HEADERS.map(h => h.toLowerCase());
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0) {
    return {
      success: false,
      rows: [],
      criticalError: {
        code: 'MISSING_HEADERS',
        message: `Missing required headers: ${missingHeaders.join(', ')}`,
        details: { missing: missingHeaders },
      },
      warnings: [],
    };
  }

  // Check if there are any data rows
  if (lines.length === 1) {
    return {
      success: false,
      rows: [],
      criticalError: {
        code: 'EMPTY_FILE',
        message: 'File contains only headers, no data rows',
      },
      warnings: [],
    };
  }

  // Parse and validate data rows
  const validRows: CSVRow[] = [];
  const allWarnings: Warning[] = [];
  let totalRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    totalRows++;
    const values = parseCSVLine(line);
    const row = rowToCSVRow(headers, values);
    const validation = validateRow(row, i);

    if (validation.isValid) {
      validRows.push(row);
    } else {
      allWarnings.push(...validation.warnings);
    }
  }

  // Check for insufficient valid rows
  if (totalRows > 0 && validRows.length / totalRows < CRITICAL_VALID_ROW_THRESHOLD) {
    return {
      success: false,
      rows: [],
      criticalError: {
        code: 'INSUFFICIENT_VALID_ROWS',
        message: `Less than ${CRITICAL_VALID_ROW_THRESHOLD * 100}% of rows are valid`,
        details: {
          validCount: validRows.length,
          totalCount: totalRows,
        },
      },
      warnings: allWarnings,
    };
  }

  return {
    success: true,
    rows: validRows,
    warnings: allWarnings,
  };
}
