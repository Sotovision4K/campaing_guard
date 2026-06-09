import { CSVRow } from '../../interfaces/csv-row.interface';
import {
  NormalisedRow,
  NormalisationResult,
} from '../../interfaces/pipeline.interface.js';

/**
 * Normalisation Stage
 *
 * Silent fixes applied (per DATA_AUDIT.md):
 * 1. ACoS format detection: compare input against (spend / sales) * 100
 *    to decide whether the value is already in percentage form or decimal.
 *    Normalised to percentage (e.g. 0.15 → 15, 15 → 15, 150 → 150).
 *    Values > 500 are flagged as _acosIsAnomaly.
 * 2. Deduplicate by (campaign_id, date) - keep LAST occurrence
 * 3. Recalculate CTR, CVR, ROAS for validation
 *
 * NOT flagged (expected behavior):
 * - orders > clicks (Amazon attribution window)
 * - CPC rounding differences (trust stored value)
 */

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || isNaN(denominator) || isNaN(numerator)) {
    return 0;
  }
  return numerator / denominator;
}

const ACOS_ANOMALY_THRESHOLD = 500;

function normaliseAcos(
  spend: number,
  sales: number,
  inputAcos: number
): { value: number; wasPercent: boolean; isAnomaly: boolean } {
  // Compute expected ACoS from the formula: (spend / sales) * 100
  const expectedAcos = safeDivide(spend, sales) * 100;

  // Edge case: sales === 0
  if (sales === 0) {
    if (spend === 0) {
      // Both zero → ACoS is undefined; trust the input but cap at 0
      return { value: 0, wasPercent: false, isAnomaly: inputAcos > ACOS_ANOMALY_THRESHOLD };
    }
    // spend > 0, sales = 0 → ACoS should be infinity.
    // Any finite input is suspicious. Assume percentage if > 10, else decimal.
    const wasPercent = inputAcos > 10;
    const value = wasPercent ? inputAcos : inputAcos * 100;
    return { value, wasPercent, isAnomaly: true };
  }

  // Compare input against expected to decide whether it is already in % or in decimal
  const distAsPercent = Math.abs(inputAcos - expectedAcos);
  const distAsDecimal = Math.abs(inputAcos * 100 - expectedAcos);

  let value: number;
  let wasPercent: boolean;

  if (distAsPercent <= distAsDecimal) {
    value = inputAcos;
    wasPercent = true;
  } else {
    value = inputAcos * 100;
    wasPercent = false;
  }

  return { value, wasPercent, isAnomaly: value > ACOS_ANOMALY_THRESHOLD };
}

function normaliseRow(row: CSVRow): NormalisedRow {
  const acosResult = normaliseAcos(row.spend, row.sales, row.acos);

  // Recalculate metrics for validation
  const ctrCalc = safeDivide(row.clicks, row.impressions);
  const cvrCalc = safeDivide(row.orders, row.clicks);
  const roasCalc = safeDivide(row.sales, row.spend);

  return {
    ...row,
    acos_normalised: acosResult.value,
    ctr_calc: ctrCalc,
    cvr_calc: cvrCalc,
    roas_calc: roasCalc,
    _wasDuplicate: false,
    _acosWasPercent: acosResult.wasPercent,
    _acosIsAnomaly: acosResult.isAnomaly,
  };
}

function createDeduplicationKey(row: CSVRow): string {
  return `${row.campaign_id}|${row.date}`;
}

export function runNormalisationStage(rows: CSVRow[]): NormalisationResult {
  if (rows.length === 0) {
    return {
      rows: [],
      stats: {
        inputCount: 0,
        outputCount: 0,
        duplicatesRemoved: 0,
        acosNormalised: 0,
      },
    };
  }

  const inputCount = rows.length;

  // Deduplicate by (campaign_id, date) - keep LAST occurrence
  // Use a Map to track the last occurrence of each key
  const deduplicatedMap = new Map<string, CSVRow>();

  for (const row of rows) {
    const key = createDeduplicationKey(row);
    deduplicatedMap.set(key, row); // Overwrites previous, keeping last
  }

  const deduplicatedRows = Array.from(deduplicatedMap.values());
  const duplicatesRemoved = inputCount - deduplicatedRows.length;

  // Normalise each row
  let acosNormalisedCount = 0;
  const normalisedRows: NormalisedRow[] = deduplicatedRows.map(row => {
    const normalised = normaliseRow(row);
    if (normalised._acosWasPercent) {
      acosNormalisedCount++;
    }
    return normalised;
  });

  return {
    rows: normalisedRows,
    stats: {
      inputCount,
      outputCount: normalisedRows.length,
      duplicatesRemoved,
      acosNormalised: acosNormalisedCount,
    },
  };
}
