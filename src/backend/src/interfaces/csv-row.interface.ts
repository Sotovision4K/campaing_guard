export interface CSVRow {
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  acos: number;
  cpc: number;
  ctr: number;
}

export type ValidationErrorCode =
  | 'MISSING_CAMPAIGN_ID'
  | 'INVALID_DATE'
  | 'CLICKS_NOT_NUMERIC'
  | 'NEGATIVE_SPEND'
  | 'CLICKS_EXCEED_IMPRESSIONS'
  | 'NEGATIVE_IMPRESSIONS'
  | 'ORDERS_EXCEED_CLICKS';

export interface ValidationError {
  field: string;
  code: ValidationErrorCode;
  message: string;
  rowIndex: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  success: boolean;
  rows: CSVRow[];
  validRows: CSVRow[];
  invalidRows: { row: CSVRow; errors: ValidationError[] }[];
  errors: ParseError[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
}