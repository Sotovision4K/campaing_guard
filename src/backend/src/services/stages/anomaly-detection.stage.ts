import { v4 as uuidv4 } from 'uuid';
import {
  NormalisedRow,
  RegimeDetectionResult,
  RawFinding,
  AnomalyDetectionResult,
  AnomalyType,
  RegimeContext,
  Severity,
  DEFAULT_ZSCORE_THRESHOLD,
  DEFAULT_ZERO_ACTIVITY_DAYS,
} from '../../interfaces/pipeline.interface.js';

/**
 * Anomaly Detection Stage
 * 
 * Detects anomalies using rule-based and statistical (z-score) methods.
 * Z-scores are calculated WITHIN each regime context.
 * 
 * Per DATA_AUDIT.md:
 * - ORDERS_EXCEED_CLICKS is NOT detected (Amazon attribution expected)
 * - Z-scores use regime-specific baselines to avoid false positives
 */

const DEFAULT_MIN_REGIME_SIZE = 15;
const MONEY_LEAKAGE_MIN_PCT = 0.20; // 20% sales drop AND 20% spend rise
const MONEY_LEAKAGE_MIN_CONSECUTIVE = 2; // require 2+ consecutive days
const ROAS_CRITICAL_THRESHOLD = 0.5; // 50% below baseline
const ROAS_HIGH_THRESHOLD = 0.8; // 20% below baseline
const ROAS_PROFITABLE_MIN = 1.5; // only include ROAS >= 1.5 in baseline calculation
const ROAS_MIN_BASELINE_FOR_CRITICAL = 2.0; // campaign must average >= 2.0 to be flagged
const ROAS_MIN_CONSECUTIVE = 2; // require 2+ consecutive bad days

interface AnomalyDetectionOptions {
  zScoreThreshold: number;
  zeroActivityDays: number;
  minRegimeSize: number;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStd(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calculateZScore(value: number, mean: number, std: number): number | undefined {
  if (std === 0) return undefined;
  return (value - mean) / std;
}

function createFinding(
  row: NormalisedRow,
  type: AnomalyType,
  metric: string,
  value: number,
  baseline: number,
  regime: RegimeContext,
  zScore?: number,
  severityHint?: Severity
): RawFinding {
  return {
    id: uuidv4(),
    campaignId: row.campaign_id,
    date: row.date,
    type,
    metric,
    value,
    baseline,
    zScore,
    regime,
    severityHint,
  };
}

interface CampaignBaseline {
  avgRoas: number;
  medianRoas: number;
  profitableDaysCount: number;
}

function calculateCampaignBaselines(
  rows: NormalisedRow[]
): Map<string, CampaignBaseline> {
  const campaignValues = new Map<string, number[]>();

  for (const row of rows) {
    const existing = campaignValues.get(row.campaign_id) || [];
    existing.push(row.roas_calc);
    campaignValues.set(row.campaign_id, existing);
  }

  const baselines = new Map<string, CampaignBaseline>();
  for (const [campaignId, values] of campaignValues) {
    const profitableValues = values.filter(v => v >= ROAS_PROFITABLE_MIN);
    if (profitableValues.length === 0) {
      baselines.set(campaignId, {
        avgRoas: calculateMean(values.filter(v => v > 0)),
        medianRoas: calculateMedian(values.filter(v => v > 0)),
        profitableDaysCount: 0,
      });
    } else {
      baselines.set(campaignId, {
        avgRoas: calculateMean(profitableValues),
        medianRoas: calculateMedian(profitableValues),
        profitableDaysCount: profitableValues.length,
      });
    }
  }
  return baselines;
}

function isConsecutiveDate(dateA: string, dateB: string): boolean {
  const d1 = new Date(dateA);
  const d2 = new Date(dateB);
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

interface RuleBasedContext {
  previousRow?: NormalisedRow;
  campaignBaselines: Map<string, CampaignBaseline>;
  consecutiveLeakageDays: Map<string, number>;
  consecutiveRoasDropDays: Map<string, number>;
}

function detectRuleBasedAnomalies(
  row: NormalisedRow,
  regime: RegimeContext,
  ctx: RuleBasedContext
): RawFinding[] {
  const findings: RawFinding[] = [];
  const { previousRow, campaignBaselines, consecutiveLeakageDays, consecutiveRoasDropDays } = ctx;

  // CLICKS_EXCEED_IMPRESSIONS - impossible, data corruption
  if (row.clicks > row.impressions) {
    findings.push(createFinding(
      row,
      'CLICKS_EXCEED_IMPRESSIONS',
      'clicks',
      row.clicks,
      row.impressions,
      regime
    ));
  }

  // SPEND_WITHOUT_CLICKS - spend > 0 but clicks = 0
  if (row.spend > 0 && row.clicks === 0) {
    findings.push(createFinding(
      row,
      'SPEND_WITHOUT_CLICKS',
      'spend',
      row.spend,
      0,
      regime
    ));
  }

  // ROAS_DROP_CRITICAL - baseline-aware with consecutive-day tracking
  // Only flag campaigns that are normally profitable (baseline >= 2.0) and experiencing sustained drops
  const baseline = campaignBaselines.get(row.campaign_id);
  if (baseline && baseline.avgRoas >= ROAS_MIN_BASELINE_FOR_CRITICAL && row.roas_calc < 1) {
    const ratio = row.roas_calc / baseline.avgRoas;

    if (previousRow && previousRow.campaign_id === row.campaign_id && isConsecutiveDate(previousRow.date, row.date)) {
      if (ratio < ROAS_CRITICAL_THRESHOLD) {
        const campaignId = row.campaign_id;
        const currentStreak = (consecutiveRoasDropDays.get(campaignId) || 0) + 1;
        consecutiveRoasDropDays.set(campaignId, currentStreak);

        if (currentStreak >= ROAS_MIN_CONSECUTIVE) {
          findings.push(createFinding(
            row,
            'ROAS_DROP_CRITICAL',
            'roas',
            row.roas_calc,
            baseline.avgRoas,
            regime,
            undefined,
            'CRITICAL'
          ));
        }
      } else if (ratio < ROAS_HIGH_THRESHOLD) {
        const campaignId = row.campaign_id;
        const currentStreak = (consecutiveRoasDropDays.get(campaignId) || 0) + 1;
        consecutiveRoasDropDays.set(campaignId, currentStreak);

        if (currentStreak >= ROAS_MIN_CONSECUTIVE) {
          findings.push(createFinding(
            row,
            'ROAS_DROP',
            'roas',
            row.roas_calc,
            baseline.avgRoas,
            regime,
            undefined,
            'HIGH'
          ));
        }
      } else {
        consecutiveRoasDropDays.set(row.campaign_id, 0);
      }
    } else {
      consecutiveRoasDropDays.set(row.campaign_id, 0);
    }
  }

  // MONEY_LEAKAGE - sales decrease AND spend increase with magnitude + consecutive-day requirements
  if (previousRow && previousRow.campaign_id === row.campaign_id) {
    if (isConsecutiveDate(previousRow.date, row.date)) {
      const salesDelta = row.sales - previousRow.sales;
      const spendDelta = row.spend - previousRow.spend;

      const salesDropPct = salesDelta / (previousRow.sales || 1);
      const spendRisePct = spendDelta / (previousRow.spend || 1);

      if (salesDropPct < -MONEY_LEAKAGE_MIN_PCT && spendRisePct > MONEY_LEAKAGE_MIN_PCT) {
        const campaignId = row.campaign_id;
        const currentStreak = (consecutiveLeakageDays.get(campaignId) || 0) + 1;
        consecutiveLeakageDays.set(campaignId, currentStreak);

        if (currentStreak >= MONEY_LEAKAGE_MIN_CONSECUTIVE) {
          findings.push(createFinding(
            row,
            'MONEY_LEAKAGE',
            'sales',
            row.sales,
            previousRow.sales,
            regime
          ));
        }
      } else {
        consecutiveLeakageDays.set(row.campaign_id, 0);
      }
    } else {
      // Reset streak on non-consecutive dates
      consecutiveLeakageDays.set(row.campaign_id, 0);
    }
  }

  // NOTE: ORDERS_EXCEED_CLICKS is NOT detected - per DATA_AUDIT.md, this is expected Amazon behavior

  return findings;
}

function detectZScoreAnomalies(
  row: NormalisedRow,
  regime: RegimeContext,
  metricStats: Map<string, { mean: number; std: number; count: number }>,
  options: AnomalyDetectionOptions
): RawFinding[] {
  const findings: RawFinding[] = [];
  const threshold = options.zScoreThreshold;

  // ACOS_SPIKE - significant increase in ACoS
  const acosStats = metricStats.get('acos_normalised');
  if (acosStats && acosStats.count >= options.minRegimeSize && acosStats.std > 0) {
    const zScore = calculateZScore(row.acos_normalised, acosStats.mean, acosStats.std);
    if (zScore !== undefined && zScore > threshold) {
      findings.push(createFinding(
        row,
        'ACOS_SPIKE',
        'acos_normalised',
        row.acos_normalised,
        acosStats.mean,
        regime,
        zScore
      ));
    }
  }

  // ROAS_DROP - significant drop in ROAS (but still >= 1, otherwise it's handled by rule-based)
  if (row.roas_calc >= 1) {
    const roasStats = metricStats.get('roas_calc');
    if (roasStats && roasStats.count >= options.minRegimeSize && roasStats.std > 0) {
      const zScore = calculateZScore(row.roas_calc, roasStats.mean, roasStats.std);
      if (zScore !== undefined && zScore < -threshold) {
        findings.push(createFinding(
          row,
          'ROAS_DROP',
          'roas_calc',
          row.roas_calc,
          roasStats.mean,
          regime,
          zScore
        ));
      }
    }
  }

  // CVR_ANOMALY - significant change (up or down) in CVR
  const cvrStats = metricStats.get('cvr_calc');
  if (cvrStats && cvrStats.count >= options.minRegimeSize && cvrStats.std > 0) {
    const zScore = calculateZScore(row.cvr_calc, cvrStats.mean, cvrStats.std);
    if (zScore !== undefined && Math.abs(zScore) > threshold) {
      findings.push(createFinding(
        row,
        'CVR_ANOMALY',
        'cvr_calc',
        row.cvr_calc,
        cvrStats.mean,
        regime,
        zScore
      ));
    }
  }

  // CTR_DROP - significant drop in CTR
  const ctrStats = metricStats.get('ctr_calc');
  if (ctrStats && ctrStats.count >= options.minRegimeSize && ctrStats.std > 0) {
    const zScore = calculateZScore(row.ctr_calc, ctrStats.mean, ctrStats.std);
    if (zScore !== undefined && zScore < -threshold) {
      findings.push(createFinding(
        row,
        'CTR_DROP',
        'ctr_calc',
        row.ctr_calc,
        ctrStats.mean,
        regime,
        zScore
      ));
    }
  }

  return findings;
}

/**
 * Determine severity for zero-activity streaks based on duration.
 *
 * ≤ safeDays:  no anomaly (new campaign grace period)
 * 8–10 days:   MEDIUM
 * 11–14 days:  HIGH
 * > 14 days:   CRITICAL
 */
function severityFromZeroDays(
  days: number,
  safeDays: number
): Severity | null {
  if (days <= safeDays) return null;
  if (days <= 10) return 'MEDIUM';
  if (days <= 14) return 'HIGH';
  return 'CRITICAL';
}

function detectZeroActivityCampaigns(
  rows: NormalisedRow[],
  regime: RegimeContext,
  options: AnomalyDetectionOptions
): RawFinding[] {
  const findings: RawFinding[] = [];
  const safeDays = options.zeroActivityDays; // grace period for new campaigns

  // Group rows by campaign
  const campaignRows = new Map<string, NormalisedRow[]>();
  for (const row of rows) {
    const existing = campaignRows.get(row.campaign_id) || [];
    existing.push(row);
    campaignRows.set(row.campaign_id, existing);
  }

  for (const [campaignId, campRows] of campaignRows) {
    // Sort by date
    const sortedRows = [...campRows].sort((a, b) => a.date.localeCompare(b.date));

    // Scan for zero-activity streaks and emit a finding for each streak
    // that exceeds the safe-days grace period.
    let streakLength = 0;
    let streakStartRow: NormalisedRow | null = null;

    for (const row of sortedRows) {
      const isZeroActivity =
        row.impressions === 0 &&
        row.clicks === 0 &&
        row.spend === 0 &&
        row.orders === 0;

      if (isZeroActivity) {
        if (streakLength === 0) {
          streakStartRow = row;
        }
        streakLength++;
      } else {
        // Streak broken — emit finding if it exceeded the safe threshold
        if (streakStartRow) {
          const severity = severityFromZeroDays(streakLength, safeDays);
          if (severity) {
            findings.push(createFinding(
              streakStartRow,
              'ZERO_ACTIVITY_CAMPAIGN',
              'activity',
              0,
              streakLength,
              regime,
              undefined,
              severity
            ));
          }
        }
        streakLength = 0;
        streakStartRow = null;
      }
    }

    // Handle streak that runs to the end of the dataset
    if (streakStartRow) {
      const severity = severityFromZeroDays(streakLength, safeDays);
      if (severity) {
        findings.push(createFinding(
          streakStartRow,
          'ZERO_ACTIVITY_CAMPAIGN',
          'activity',
          0,
          streakLength,
          regime,
          undefined,
          severity
        ));
      }
    }
  }

  return findings;
}

function calculateMetricStats(rows: NormalisedRow[]): Map<string, { mean: number; std: number; count: number }> {
  const stats = new Map<string, { mean: number; std: number; count: number }>();

  const metrics = ['acos_normalised', 'roas_calc', 'cvr_calc', 'ctr_calc'] as const;

  for (const metric of metrics) {
    const values = rows.map(r => r[metric]).filter(v => !isNaN(v) && isFinite(v));
    const mean = calculateMean(values);
    const std = calculateStd(values, mean);
    stats.set(metric, { mean, std, count: values.length });
  }

  return stats;
}

export function runAnomalyDetectionStage(
  regimeResult: RegimeDetectionResult,
  options?: Partial<AnomalyDetectionOptions>
): AnomalyDetectionResult {
  const opts: AnomalyDetectionOptions = {
    zScoreThreshold: options?.zScoreThreshold ?? DEFAULT_ZSCORE_THRESHOLD,
    zeroActivityDays: options?.zeroActivityDays ?? DEFAULT_ZERO_ACTIVITY_DAYS,
    minRegimeSize: options?.minRegimeSize ?? DEFAULT_MIN_REGIME_SIZE,
  };

  const allFindings: RawFinding[] = [];
  const byCampaign: Record<string, number> = {};
  const byType: Partial<Record<AnomalyType, number>> = {};

  // Calculate campaign baselines across ALL regimes for consistent comparison
  const allRows: NormalisedRow[] = [];
  for (const regime of regimeResult.regimes) {
    const rows = regimeResult.rowsByRegime.get(regime.id) || [];
    allRows.push(...rows);
  }
  const campaignBaselines = calculateCampaignBaselines(allRows);

  for (const regime of regimeResult.regimes) {
    const rows = regimeResult.rowsByRegime.get(regime.id) || [];
    if (rows.length === 0) continue;

    const regimeContext: RegimeContext = {
      id: regime.id,
      startDate: regime.startDate,
      endDate: regime.endDate,
    };

    // Calculate metric statistics for this regime
    const metricStats = calculateMetricStats(rows);

    // Sort rows by campaign and date for day-over-day comparison
    const sortedRows = [...rows].sort((a, b) => {
      const campaignCmp = a.campaign_id.localeCompare(b.campaign_id);
      if (campaignCmp !== 0) return campaignCmp;
      return a.date.localeCompare(b.date);
    });

    // Detect anomalies for each row
    let previousRow: NormalisedRow | undefined;
    const consecutiveLeakageDays = new Map<string, number>();
    const consecutiveRoasDropDays = new Map<string, number>();
    for (const row of sortedRows) {
      const ctx: RuleBasedContext = {
        previousRow,
        campaignBaselines,
        consecutiveLeakageDays,
        consecutiveRoasDropDays,
      };

      // Rule-based anomalies
      const ruleFindings = detectRuleBasedAnomalies(row, regimeContext, ctx);
      allFindings.push(...ruleFindings);

      // Z-score based anomalies
      const zScoreFindings = detectZScoreAnomalies(row, regimeContext, metricStats, opts);
      allFindings.push(...zScoreFindings);

      previousRow = row;
    }

    // Zero activity detection (per-campaign)
    const zeroActivityFindings = detectZeroActivityCampaigns(rows, regimeContext, opts);
    allFindings.push(...zeroActivityFindings);
  }

  // Aggregate stats
  for (const finding of allFindings) {
    byCampaign[finding.campaignId] = (byCampaign[finding.campaignId] || 0) + 1;
    byType[finding.type] = (byType[finding.type] || 0) + 1;
  }

  return {
    findings: allFindings,
    stats: {
      total: allFindings.length,
      byCampaign,
      byType,
    },
  };
}
