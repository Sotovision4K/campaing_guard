import { CSVRow, ValidationResult, ValidationError, ValidationErrorCode, ParseResult, ParseError } from '../interfaces/csv-row.interface.js';

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

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function validateRow(row: CSVRow, rowIndex: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (!row.campaign_id || row.campaign_id.trim() === '') {
    errors.push({
      field: 'campaign_id',
      code: 'MISSING_CAMPAIGN_ID',
      message: 'Campaign ID is required and cannot be empty',
      rowIndex,
    });
  }

  if (!row.date || !isValidDate(row.date)) {
    errors.push({
      field: 'date',
      code: 'INVALID_DATE',
      message: 'Date must be in valid ISO 8601 format (YYYY-MM-DD)',
      rowIndex,
    });
  }

  if (!isNumeric(row.clicks)) {
    errors.push({
      field: 'clicks',
      code: 'CLICKS_NOT_NUMERIC',
      message: 'Clicks must be a valid number',
      rowIndex,
    });
  }

  if (isNumeric(row.spend) && row.spend < 0) {
    errors.push({
      field: 'spend',
      code: 'NEGATIVE_SPEND',
      message: 'Spend cannot be negative',
      rowIndex,
    });
  }

  if (isNumeric(row.clicks) && isNumeric(row.impressions) && row.clicks > row.impressions) {
    errors.push({
      field: 'clicks',
      code: 'CLICKS_EXCEED_IMPRESSIONS',
      message: 'Clicks cannot exceed impressions',
      rowIndex,
    });
  }

  if (isNumeric(row.impressions) && row.impressions < 0) {
    errors.push({
      field: 'impressions',
      code: 'NEGATIVE_IMPRESSIONS',
      message: 'Impressions cannot be negative',
      rowIndex,
    });
  }

  if (isNumeric(row.orders) && isNumeric(row.clicks) && row.orders > row.clicks) {
    errors.push({
      field: 'orders',
      code: 'ORDERS_EXCEED_CLICKS',
      message: 'Orders cannot exceed clicks',
      rowIndex,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
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

export function parseAndValidate(buffer: Buffer): ParseResult {
  const errors: ParseError[] = [];
  const rows: CSVRow[] = [];
  const validRows: CSVRow[] = [];
  const invalidRows: { row: CSVRow; errors: ValidationError[] }[] = [];

  const content = buffer.toString('utf-8').trim();

  if (!content) {
    return {
      success: false,
      rows: [],
      validRows: [],
      invalidRows: [],
      errors: [{ row: 0, message: 'Empty file' }],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
    };
  }

  const lines = content.split(/\r?\n/);

  if (lines.length === 0) {
    return {
      success: false,
      rows: [],
      validRows: [],
      invalidRows: [],
      errors: [{ row: 0, message: 'No data in file' }],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
    };
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

  // Validate headers
  const requiredHeaders = CSV_HEADERS.map(h => h.toLowerCase());
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0 && missingHeaders.length === requiredHeaders.length) {
    return {
      success: false,
      rows: [],
      validRows: [],
      invalidRows: [],
      errors: [{ row: 0, message: `Missing required headers: ${missingHeaders.join(', ')}` }],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const csvRow = rowToCSVRow(headers, values);
    rows.push(csvRow);

    const validationResult = validateRow(csvRow, i);

    if (validationResult.isValid) {
      validRows.push(csvRow);
    } else {
      invalidRows.push({ row: csvRow, errors: validationResult.errors });
    }
  }

  return {
    success: true,
    rows,
    validRows,
    invalidRows,
    errors,
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
  };
}