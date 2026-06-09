# Pipeline Analytics Implementation Plan

## Overview

Amazon PPC Campaign Anomaly Detection Pipeline - detects anomalies in advertising campaign data using rule-based and statistical methods, validated by Anthropic Claude LLM.

## Pipeline Workflow

```
CSV in
  ↓
[data quality]      → internal errors only, stop pipeline if critical
  ↓
[normalisation]     → internal, fixes ACoS/spend/duplicates silently
  ↓
[regime detection]  → internal, sets context window for z-scores
  ↓
[anomaly detection] → produces findings
  ↓
[LLM validation]    → labels findings (Anthropic Claude)
  ↓
Anomalies out       → this is all the user ever sees
```

---

## File Structure

```
src/backend/src/
├── interfaces/
│   ├── csv-row.interface.ts          # existing
│   └── pipeline.interface.ts         # NEW - all pipeline types
├── services/
│   ├── pipeline.service.ts           # NEW - orchestrator
│   ├── anthropic.service.ts          # NEW - Claude integration
│   ├── audit.service.ts              # NEW - audit logging
│   └── stages/
│       ├── data-quality.stage.ts     # NEW
│       ├── normalisation.stage.ts    # NEW
│       ├── regime-detection.stage.ts # NEW
│       ├── anomaly-detection.stage.ts# NEW
│       └── llm-validation.stage.ts   # NEW
├── repositories/
│   ├── anomaly.repository.ts         # NEW
│   └── report.repository.ts          # NEW
├── prompts/
│   └── anomaly-validation.prompt.ts  # NEW
└── constants/
    └── anomaly-types.ts              # NEW
```

---

## Stage 1: Data Quality

**File:** `services/stages/data-quality.stage.ts`

```typescript
interface DataQualityInput {
  buffer: Buffer;
}

interface DataQualityResult {
  success: boolean;
  rows: CSVRow[];
  criticalError?: CriticalError;  // Halts pipeline
  warnings: Warning[];            // Logged internally, not exposed
}

type CriticalError = 
  | { code: 'EMPTY_FILE' }
  | { code: 'MISSING_HEADERS'; missing: string[] }
  | { code: 'INSUFFICIENT_VALID_ROWS'; validCount: number; totalCount: number };

// Critical threshold: <50% valid rows halts pipeline
```

---

## Stage 2: Normalisation

**File:** `services/stages/normalisation.stage.ts`

```typescript
interface NormalisedRow extends CSVRow {
  // Normalised metrics (CRITICAL per DATA_AUDIT)
  acos_normalised: number;      // Always decimal: if acos > 1, divide by 100
  
  // Recalculated for validation (use stored values as source of truth)
  ctr_calc: number;             // clicks / impressions
  cvr_calc: number;             // orders / clicks  
  roas_calc: number;            // sales / spend
  
  // Metadata
  _wasDuplicate: boolean;
  _acosWasPercent: boolean;
}

interface NormalisationResult {
  rows: NormalisedRow[];
  stats: {
    inputCount: number;
    outputCount: number;
    duplicatesRemoved: number;      // Silently removed
    acosNormalised: number;         // Count where acos > 1 was fixed
  };
}
```

**Silent Fixes (per DATA_AUDIT.md):**
1. Deduplicate by (campaign_id, date) - keep LAST occurrence
2. ACoS > 1 → divide by 100 (73 → 0.73)
3. DO NOT flag orders > clicks (Amazon attribution - expected)
4. Trust stored CPC (ignore rounding differences)

---

## Stage 3: Regime Detection

**File:** `services/stages/regime-detection.stage.ts`

```typescript
interface Regime {
  id: string;
  startDate: string;           // ISO date
  endDate: string;
  type: 'normal' | 'high_spend' | 'low_activity';
  campaignIds: string[];
  stats: {
    avgSpend: number;
    avgImpressions: number;
  };
}

interface RegimeDetectionResult {
  regimes: Regime[];
  breakpoints: string[];        // e.g., ['2025-04-26'] per DATA_AUDIT
  rowsByRegime: Map<string, NormalisedRow[]>;
}
```

**CRITICAL per DATA_AUDIT:**
- Spend spikes after 2025-04-26
- Must detect this breakpoint to avoid false positives
- Z-scores calculated WITHIN each regime, not across all data

---

## Stage 4: Anomaly Detection

**File:** `services/stages/anomaly-detection.stage.ts`

```typescript
// CORRECTED: Removed ORDERS_EXCEED_CLICKS per DATA_AUDIT (Amazon attribution expected)
type AnomalyType =
  | 'CLICKS_EXCEED_IMPRESSIONS'   // IMPOSSIBLE - data corruption
  | 'SPEND_WITHOUT_CLICKS'        // spend > 0 && clicks = 0
  | 'ACOS_SPIKE'                  // z-score > 2.5 within regime
  | 'MONEY_LEAKAGE'               // sales↓ AND spend↑ (day-over-day)
  | 'ROAS_DROP_CRITICAL'          // ROAS < 1 (losing money)
  | 'ROAS_DROP'                   // z-score < -2 within regime
  | 'CVR_ANOMALY'                 // z-score |value| > 2 (drop OR spike)
  | 'CTR_DROP'                    // z-score < -2
  | 'ZERO_ACTIVITY_CAMPAIGN';     // all core metrics = 0 for 7+ consecutive days

interface RawFinding {
  id: string;                     // UUID
  campaignId: string;
  date: string;
  type: AnomalyType;
  metric: string;
  value: number;
  baseline: number;               // Regime average
  zScore?: number;
  regime: {
    id: string;
    startDate: string;
    endDate: string;
  };
}

interface AnomalyDetectionResult {
  findings: RawFinding[];
  stats: {
    total: number;
    byCampaign: Record<string, number>;
    byType: Record<AnomalyType, number>;
  };
}
```

**Detection Rules:**

| Type | Logic | Z-Score? |
|------|-------|----------|
| `CLICKS_EXCEED_IMPRESSIONS` | `clicks > impressions` | No |
| `SPEND_WITHOUT_CLICKS` | `spend > 0 && clicks === 0` | No |
| `ACOS_SPIKE` | `zScore(acos_normalised) > 2.5` | Yes, within regime |
| `MONEY_LEAKAGE` | `salesΔ < 0 && spendΔ > 0` (vs previous day) | No |
| `ROAS_DROP_CRITICAL` | `roas < 1` | No |
| `ROAS_DROP` | `zScore(roas) < -2` | Yes, within regime |
| `CVR_ANOMALY` | `abs(zScore(cvr)) > 2` | Yes, within regime |
| `CTR_DROP` | `zScore(ctr) < -2` | Yes, within regime |
| `ZERO_ACTIVITY_CAMPAIGN` | `impressions + clicks + spend + orders = 0` for 7+ days | No |

---

## Stage 5: LLM Validation

**File:** `services/stages/llm-validation.stage.ts`

```typescript
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ValidatedAnomaly {
  id: string;
  campaignId: string;
  date: string;
  type: AnomalyType;
  severity: Severity;
  title: string;                  // Human-readable, e.g., "Spending without clicks"
  insight: string;                // LLM explanation (1-2 sentences)
  suggestedAction: string;        // e.g., "Pause campaign and investigate"
  confidence: number;             // 0-1
  metadata: {
    metric: string;
    value: number;
    baseline: number;
    zScore?: number;
    regimeId: string;
  };
}

interface LLMValidationResult {
  anomalies: ValidatedAnomaly[];  // Final user-facing output
  filtered: {
    count: number;
    reasons: string[];            // Why LLM rejected them
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

**Anthropic Service:**

```typescript
// services/anthropic.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function validateFindings(
  findings: RawFinding[]
): Promise<ValidatedAnomaly[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: ANOMALY_VALIDATION_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify({ findings })
    }]
  });
  
  return parseValidatedAnomalies(response);
}
```

---

## Pipeline Orchestrator

**File:** `services/pipeline.service.ts`

```typescript
interface PipelineInput {
  buffer: Buffer;
  options?: {
    zScoreThreshold?: number;     // default: 2.5
    zeroActivityDays?: number;    // default: 7
  };
}

interface PipelineOutput {
  success: true;
  requestId: string;
  report: {
    id: string;
    totalRows: number;
    regimesDetected: number;
    anomaliesFound: number;
    bySeverity: Record<Severity, number>;
    processingTime_ms: number;
  };
  anomaliesByCampaign: Record<string, ValidatedAnomaly[]>;
}

interface PipelineError {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    stage: 'data_quality' | 'normalisation' | 'regime_detection' | 'anomaly_detection' | 'llm_validation';
  };
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput | PipelineError> {
  // 1. Data Quality (can halt)
  // 2. Normalisation (silent fixes)
  // 3. Regime Detection (sets context)
  // 4. Anomaly Detection (produces findings)
  // 5. LLM Validation (labels findings)
  // → Return only ValidatedAnomaly[] grouped by campaign
}
```

---

## Database Entities (SQL)

Per SPEC.md, three entities:

```typescript
// Entity: audit_logs - Track every pipeline step
interface AuditLog {
  id: string;
  requestId: string;
  timestamp: Date;
  stage: 'data_quality' | 'normalisation' | 'regime_detection' | 'anomaly_detection' | 'llm_validation';
  action: string;
  input?: object;
  output?: object;
  duration_ms: number;
  status: 'success' | 'failure' | 'skipped';
  error?: string;
}

// Entity: anomalies - Detected and validated anomalies
interface AnomalyEntity {
  id: string;
  requestId: string;
  campaignId: string;
  date: string;
  type: AnomalyType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  insight: string;
  suggestedAction: string;
  metric: string;
  value: number;
  baseline: number;
  zScore?: number;
  regimeId: string;
  confidence: number;
  userAction?: string;
  actionedAt?: Date;
  createdAt: Date;
}

// Entity: reports - Aggregated pipeline runs
interface Report {
  id: string;
  requestId: string;
  createdAt: Date;
  totalRows: number;
  validRows: number;
  regimesDetected: number;
  anomaliesFound: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byCampaign: Record<string, number>;
  llmTokensUsed: number;
  processingTime_ms: number;
}
```

---

## Implementation Tasks

| Phase | Task | File | Priority |
|-------|------|------|----------|
| **1** | Create pipeline interfaces | `interfaces/pipeline.interface.ts` | HIGH |
| **1** | Create anomaly type constants | `constants/anomaly-types.ts` | HIGH |
| **1** | Create pipeline orchestrator shell | `services/pipeline.service.ts` | HIGH |
| **2** | Refactor data quality into stage | `services/stages/data-quality.stage.ts` | HIGH |
| **2** | Implement normalisation (dedup, ACoS fix) | `services/stages/normalisation.stage.ts` | HIGH |
| **2** | Implement regime detection | `services/stages/regime-detection.stage.ts` | HIGH |
| **3** | Implement anomaly detection | `services/stages/anomaly-detection.stage.ts` | HIGH |
| **3** | Create Anthropic service | `services/anthropic.service.ts` | HIGH |
| **3** | Create validation prompt | `prompts/anomaly-validation.prompt.ts` | MEDIUM |
| **3** | Implement LLM validation stage | `services/stages/llm-validation.stage.ts` | HIGH |
| **4** | Wire up pipeline orchestrator | `services/pipeline.service.ts` | HIGH |
| **4** | Create audit service | `services/audit.service.ts` | MEDIUM |
| **4** | Update upload controller | `controllers/upload.controller.ts` | MEDIUM |
| **4** | Add tests | `services/__tests__/` | HIGH |

---

## Error Handling Matrix

| Stage | Error Type | Critical? | User Impact |
|-------|------------|-----------|-------------|
| Data Quality | Empty file | YES | Pipeline halts, error response |
| Data Quality | Missing headers | YES | Pipeline halts, error response |
| Data Quality | <50% valid rows | YES | Pipeline halts, error response |
| Data Quality | Individual row invalid | NO | Skip row silently |
| Normalisation | None expected | NO | N/A |
| Regime Detection | Cannot detect regimes | NO | Use full dataset as single regime |
| Anomaly Detection | None expected | NO | N/A |
| LLM Validation | Anthropic API failure | NO | Retry 3x, then return raw findings |
| LLM Validation | Rate limit | NO | Exponential backoff, then partial results |

---

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
ZSCORE_THRESHOLD=2.5
ZERO_ACTIVITY_DAYS=7
LLM_BATCH_SIZE=25
LLM_MAX_RETRIES=3
```

---

## Excluded Features (per SPEC.md)

- Machine Learning models
- Authentication/Authorization
- LLM Router
- RAG
- Queues
- Data enrichment
