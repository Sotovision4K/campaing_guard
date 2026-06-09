import { v4 as uuidv4 } from 'uuid';
import {
  NormalisedRow,
  Regime,
  RegimeDetectionResult,
  RegimeType,
} from '../../interfaces/pipeline.interface.js';

/**
 * Regime Detection Stage
 * 
 * Detects spending regime changes to avoid false positives in anomaly detection.
 * Per DATA_AUDIT.md: spend spikes after 2025-04-26, must split data into regimes.
 * Z-scores are calculated WITHIN each regime, not across all data.
 */

interface DateAggregation {
  date: string;
  totalSpend: number;
  totalImpressions: number;
  rowCount: number;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStd(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

function aggregateByDate(rows: NormalisedRow[]): DateAggregation[] {
  const dateMap = new Map<string, DateAggregation>();

  for (const row of rows) {
    const existing = dateMap.get(row.date);
    if (existing) {
      existing.totalSpend += row.spend;
      existing.totalImpressions += row.impressions;
      existing.rowCount++;
    } else {
      dateMap.set(row.date, {
        date: row.date,
        totalSpend: row.spend,
        totalImpressions: row.impressions,
        rowCount: 1,
      });
    }
  }

  // Sort by date
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function detectBreakpoints(aggregations: DateAggregation[]): string[] {
  if (aggregations.length < 10) return []; // Need enough data for regime detection

  const spendValues = aggregations.map(a => a.totalSpend);
  const overallMean = calculateMean(spendValues);
  const overallStd = calculateStd(spendValues, overallMean);

  if (overallStd === 0) return []; // No variance, single regime

  const breakpoints: string[] = [];
  const windowSize = 5;

  // Simple changepoint detection: look for significant shifts in rolling mean
  for (let i = windowSize; i < aggregations.length - windowSize; i++) {
    const beforeWindow = spendValues.slice(i - windowSize, i);
    const afterWindow = spendValues.slice(i, i + windowSize);

    const beforeMean = calculateMean(beforeWindow);
    const afterMean = calculateMean(afterWindow);

    // Detect significant change (>2x or <0.5x change in mean)
    const ratio = afterMean / (beforeMean || 1);
    if (ratio > 2 || ratio < 0.5) {
      breakpoints.push(aggregations[i].date);
      // Skip ahead to avoid detecting same breakpoint multiple times
    }
  }

  // Deduplicate breakpoints that are too close together
  const filteredBreakpoints: string[] = [];
  for (const bp of breakpoints) {
    const lastBp = filteredBreakpoints[filteredBreakpoints.length - 1];
    if (!lastBp) {
      filteredBreakpoints.push(bp);
    } else {
      const daysDiff = Math.abs(
        (new Date(bp).getTime() - new Date(lastBp).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff >= 7) {
        filteredBreakpoints.push(bp);
      }
    }
  }

  return filteredBreakpoints;
}

function determineRegimeType(avgSpend: number, avgImpressions: number, overallAvgSpend: number): RegimeType {
  if (avgSpend === 0 && avgImpressions === 0) {
    return 'low_activity';
  }
  if (avgSpend > overallAvgSpend * 1.5) {
    return 'high_spend';
  }
  return 'normal';
}

function createRegime(
  rows: NormalisedRow[],
  startDate: string,
  endDate: string,
  overallAvgSpend: number
): Regime {
  const spendValues = rows.map(r => r.spend);
  const impressionValues = rows.map(r => r.impressions);

  const avgSpend = calculateMean(spendValues);
  const avgImpressions = calculateMean(impressionValues);
  const stdSpend = calculateStd(spendValues, avgSpend);
  const stdImpressions = calculateStd(impressionValues, avgImpressions);

  const campaignIds = [...new Set(rows.map(r => r.campaign_id))];

  return {
    id: uuidv4(),
    startDate,
    endDate,
    type: determineRegimeType(avgSpend, avgImpressions, overallAvgSpend),
    campaignIds,
    stats: {
      avgSpend,
      avgImpressions,
      stdSpend,
      stdImpressions,
    },
  };
}

export function runRegimeDetectionStage(rows: NormalisedRow[]): RegimeDetectionResult {
  if (rows.length === 0) {
    return {
      regimes: [],
      breakpoints: [],
      rowsByRegime: new Map(),
    };
  }

  // Sort rows by date
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // Calculate overall average spend for regime type determination
  const overallAvgSpend = calculateMean(sortedRows.map(r => r.spend));

  // Aggregate data by date for breakpoint detection
  const aggregations = aggregateByDate(sortedRows);

  // Detect breakpoints
  const breakpoints = detectBreakpoints(aggregations);

  // Split rows into regimes based on breakpoints
  const regimes: Regime[] = [];
  const rowsByRegime = new Map<string, NormalisedRow[]>();

  if (breakpoints.length === 0) {
    // Single regime
    const regime = createRegime(
      sortedRows,
      sortedRows[0].date,
      sortedRows[sortedRows.length - 1].date,
      overallAvgSpend
    );
    regimes.push(regime);
    rowsByRegime.set(regime.id, sortedRows);
  } else {
    // Multiple regimes
    let currentStartIdx = 0;

    for (let bpIdx = 0; bpIdx <= breakpoints.length; bpIdx++) {
      const breakpoint = breakpoints[bpIdx];
      const endIdx = breakpoint
        ? sortedRows.findIndex(r => r.date >= breakpoint)
        : sortedRows.length;

      if (endIdx > currentStartIdx) {
        const regimeRows = sortedRows.slice(currentStartIdx, endIdx === -1 ? undefined : endIdx);
        if (regimeRows.length > 0) {
          const regime = createRegime(
            regimeRows,
            regimeRows[0].date,
            regimeRows[regimeRows.length - 1].date,
            overallAvgSpend
          );
          regimes.push(regime);
          rowsByRegime.set(regime.id, regimeRows);
        }
        currentStartIdx = endIdx === -1 ? sortedRows.length : endIdx;
      }
    }

    // Handle remaining rows after last breakpoint
    if (currentStartIdx < sortedRows.length) {
      const regimeRows = sortedRows.slice(currentStartIdx);
      const regime = createRegime(
        regimeRows,
        regimeRows[0].date,
        regimeRows[regimeRows.length - 1].date,
        overallAvgSpend
      );
      regimes.push(regime);
      rowsByRegime.set(regime.id, regimeRows);
    }
  }

  return {
    regimes,
    breakpoints,
    rowsByRegime,
  };
}
