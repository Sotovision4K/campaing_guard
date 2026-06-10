# Profasee Pipeline Endpoint Specification

## Overview
CSV ingestion and processing pipeline for advertising campaign analytics.

## Architecture

### Backend Structure (`src/backend`)
```
src/backend/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── app.ts
    ├── controllers/
    │   ├── anomaly.controller.ts
    │   └── data.controller.ts
    ├── db/
    │   ├── index.ts
    │   ├── models.ts
    │   └── repositories/
    │       ├── anomaly.repository.ts
    │       ├── audit-log.repository.ts
    │       └── report.repository.ts
    ├── interfaces/
    │   ├── csv-row.interface.ts
    │   └── pipeline.interface.ts
    ├── middleware/
    │   ├── error-handler.ts
    │   ├── errors.ts
    │   └── request-id.ts
    ├── prompts/
    ├── routes/
    │   ├── index.ts
    │   ├── anomaly.routes.ts
    │   ├── data.routes.ts
    │   └── __tests__/
    ├── services/
    │   ├── analytics-stage.service.ts
    │   ├── pipeline.service.ts
    │   ├── __tests__/
    │   └── stages/
    │       ├── anomaly-detection.stage.ts
    │       ├── data-quality.stage.ts
    │       ├── llm-validation.stage.ts
    │       ├── normalisation.stage.ts
    │       ├── regime-detection.stage.ts
    │       └── __tests__/
    └── utils/
        └── hash.ts
```

### Frontend Structure (`src/frontend`)
```
src/frontend/
├── public/
└── src/
    ├── App.module.css
    ├── App.tsx
    ├── main.tsx
    ├── api/
    │   └── client.ts                # Global API client (axios)
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    ├── components/
    │   ├── index.ts
    │   ├── AnomalyDetail/
    │   ├── AnomalyGroup/
    │   ├── AnomalyRow/
    │   ├── AnomalyTypeChart/
    │   ├── CampaignList/
    │   ├── CampaignTabs/
    │   ├── PipelineProgress/
    │   ├── SeverityBadge/
    │   ├── SeverityBreakdown/
    │   ├── SeverityDonut/
    │   ├── SummaryCards/
    │   ├── SummaryMetrics/
    │   ├── Top5Ranking/
    │   └── TopBar/
    ├── hooks/
    │   ├── useAnomalies.ts
    │   ├── useAnomalyDashboard.test.ts
    │   ├── useAnomalyDashboard.ts
    │   ├── useCampaignAnomalies.ts
    │   └── useUpload.ts
    ├── pages/
    │   ├── dropzone/                # CSV upload view
    │   │   ├── Dropzone.tsx
    │   │   ├── ResultsDashboard.module.css
    │   │   ├── ResultsDashboard.tsx
    │   │   ├── UploadProgress.tsx
    │   │   ├── UploadResult.tsx
    │   │   └── index.tsx
    │   ├── anomalies/               # Anomaly display view
    │   │   ├── Anomalies.module.css
    │   │   └── index.tsx
    │   └── insights/                # LLM insights view
    │       ├── Insights.module.css
    │       └── index.tsx
    ├── services/
    │   ├── anomalies.service.ts
    │   └── upload.service.ts
    ├── styles/
    │   ├── dropzone.module.css
    │   ├── global.css
    │   └── upload-result.module.css
    ├── test/
    │   └── setup.ts
    └── types/
        ├── anomaly.ts
        └── index.ts
```

### Data Flow
```
CSV Upload → Parse → Stage → Group by Campaign → Flag Anomalies → Generate Insights
     ↓           ↓         ↓              ↓              ↓
  /upload    validate   enrich       campaigns        /insights
```

---

## Validation Rules

### CSV Row Validation (`validateRow`)

| Rule | Error Code | Description |
|------|------------|-------------|
| Valid row | - | All required fields present with valid values |
| Missing campaign_id | `MISSING_CAMPAIGN_ID` | campaign_id is empty or null |
| Invalid date | `INVALID_DATE` | Date not in ISO 8601 format (YYYY-MM-DD) |
| Clicks not numeric | `CLICKS_NOT_NUMERIC` | Clicks contains non-numeric value |
| Negative spend | `NEGATIVE_SPEND` | Spend field contains negative number |
| Clicks > impressions | `CLICKS_EXCEED_IMPRESSIONS` | Logic error: clicks cannot exceed impressions |
| Negative impressions | `NEGATIVE_IMPRESSIONS` | Impressions field contains negative number |
| Orders > clicks | `ORDERS_EXCEED_CLICKS` | Logic error: orders cannot exceed clicks |

### Interface

```typescript
interface CSVRow {
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
  cvr: number;
  roas: number;
}

interface ValidationError {
  field: string;
  code: 'MISSING_CAMPAIGN_ID' | 'INVALID_DATE' | 'CLICKS_NOT_NUMERIC' | 'NEGATIVE_SPEND' | 'CLICKS_EXCEED_IMPRESSIONS' | 'NEGATIVE_IMPRESSIONS' | 'ORDERS_EXCEED_CLICKS';
  message: string;
  rowIndex: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

function validateRow(row: CSVRow, rowIndex: number): ValidationResult
```

---

## Backend Services (Planned)

### 1. Analytics Stage Service
- `parseAndValidate(buffer: Buffer): ParseResult` - Parse CSV and validate rows
- `enrich(rows: CSVRow[]): StagedRow[]` - Add computed metrics and campaign type
- `detectDataQualityIssues(rows: CSVRow[]): DataQualityReport` - Report data quality

### 2. Campaign Grouping Service
- `groupByCampaign(rows: StagedRow[]): Campaign[]` - Group data by campaign_id
- `aggregateMetrics(rows: StagedRow[]): CampaignMetrics` - Compute aggregated metrics
- `detectDuplicates(rows: StagedRow[]): DuplicateEntry[]` - Find duplicate date entries

### 3. Anomaly Flagging Service
- `detectAnomalies(campaigns: Campaign[]): Anomaly[]` - Detect all anomaly types
- `detectStatisticalOutliers(rows, metric, threshold): Anomaly[]` - Z-score detection
- `detectImpossibleValues(rows: StagedRow[]): Anomaly[]` - Logical impossible values
- `detectZeroValueCampaigns(campaigns, thresholdDays): Anomaly[]` - Prolonged no activity
- `detectPerformanceDegradation(campaigns): Anomaly[]` - Spend up, sales down

### 4. LLM Insight Service
- `generateInsights(campaigns, anomalies, options): LLMInsight[]` - Generate AI insights
- `generateCampaignInsight(campaign, model): LLMInsight` - Single campaign insight
- `generateSummaryInsight(campaigns, model): LLMInsight` - Cross-campaign summary
- `getAuditLog(filters): PaginatedResult<AuditEntry>` - Retrieve audit entries

---

## Frontend Pages (Planned)

### 1. Dropzone Page (`pages/dropzone`)
- File upload with drag-and-drop
- Upload progress indicator
- Upload status display

### 2. Anomalies Page (`pages/anomalies`)
- Table/grid displaying flagged anomalies
- Filters by severity, metric, campaign
- Anomaly detail view

### 3. Insights Page (`pages/insights`)
- Card/list view for LLM-generated insights
- Insight detail expansion
- Category filtering

---

## Logging & Audit

### General Application Logs
- Request logging with requestId
- Error logging with stack traces
- Performance logging for slow operations

### LLM Audit Log Schema
```typescript
interface AuditEntry {
  id: string;
  timestamp: string;          // ISO 8601
  requestId: string;          // Distributed trace ID
  userId: string | null;
  action: 'llm_insight_request';
  model: string;
  prompt: string;
  response: string;
  responseTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}
```

---

## API Endpoints (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload-csv` | Upload and process CSV file |
| GET | `/api/campaigns` | Get all campaigns |
| GET | `/api/campaigns/:id` | Get campaign by ID |
| GET | `/api/anomalies` | Get flagged anomalies |
| GET | `/api/insights` | Get LLM-generated insights |
| GET | `/api/audit-logs` | Get LLM audit logs |

---

## Error Handling Strategy

### Layer-Specific Errors
- **Routes**: Client errors (400, 413, 422) - Validate request format
- **Controllers**: Transform service errors to HttpError - Never expose internal details
- **Services**: Domain-specific errors (InvalidCSVFormat, AnomalyThreshold) - Result pattern
- **Infrastructure**: Database, Queue, LLM API errors - Circuit breakers, retry with backoff

### Error Classes
```typescript
class ValidationError extends AppError      // 400
class FileProcessingError extends AppError  // 422
class AnomalyDetectionError extends AppError // 500 (non-retryable)
class LLMError extends AppError              // 502 (retryable)
class QueueError extends AppError            // 503
```

---

## Testing

### Test Framework
- **Vitest** for unit testing
- Tests in `__tests__/` folders alongside source files

### Current Test Coverage
- 17 tests for CSV row validation
- All validation rules covered: valid rows, missing campaign_id, invalid date, non-numeric clicks, negative spend, clicks > impressions, negative impressions, orders > clicks

---

## Technology Stack

### Backend
- **Runtime**: Node.js / Express
- **Language**: TypeScript
- **Testing**: Vitest

### Frontend
- **Framework**: React (planned)
- **Build**: Vite (planned)
- **State**: React Query / Zustand (planned)