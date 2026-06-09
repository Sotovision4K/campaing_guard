# Profasee - Campaign Guardian

**An Amazon PPC campaign anomaly detection and audit tool.**

---

## Architecture Overview

```
profasee/
├── src/
│   ├── backend/           # Node.js/Express API server (TypeScript)
│   └── frontend/          # React + Vite SPA
├── SPEC.md                # Project specifications
├── PIPELINE.md            # Pipeline implementation details
└── docker-compose.yml     # Docker orchestration
```

**Technology Stack:**

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| LLM | Anthropic Claude SDK |
| Frontend | React 19, Vite, React Router v7 |
| Testing | Vitest |

---

## Backend Architecture

```
src/backend/src/
├── app.ts                    # Express entry point
├── interfaces/
│   ├── csv-row.interface.ts   # CSV parsing types
│   └── pipeline.interface.ts  # Pipeline stage types & constants
├── controllers/
│   ├── anomaly.controller.ts  # Main upload & anomaly CRUD
│   └── data.controller.ts     # Legacy data processing
├── db/
│   ├── index.ts              # PostgreSQL pool & init
│   ├── models.ts             # TypeScript entity interfaces
│   └── repositories/
│       ├── anomaly.repository.ts
│       ├── audit-log.repository.ts
│       └── report.repository.ts
├── middleware/
│   ├── errors.ts             # Custom error classes
│   ├── error-handler.ts      # Global error handler
│   └── request-id.ts         # Request ID middleware
├── routes/
│   ├── index.ts              # Route aggregator
│   └── anomaly.routes.ts     # Anomaly API routes
├── services/
│   ├── pipeline.service.ts    # Pipeline orchestrator
│   ├── analytics-stage.service.ts
│   └── stages/
│       ├── data-quality.stage.ts       # Stage 1
│       ├── normalisation.stage.ts      # Stage 2
│       ├── regime-detection.stage.ts   # Stage 3
│       ├── anomaly-detection.stage.ts  # Stage 4
│       └── llm-validation.stage.ts     # Stage 5
└── utils/
    └── hash.ts               # File hashing utility
```

### Key Configuration Files

- `.env` - Environment variables (DB config, Anthropic API key)
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test runner configuration
- `Dockerfile` / `Dockerfile.dev` - Container configurations

---

## Pipeline Architecture

The backend implements a **5-stage data processing pipeline** for CSV ingestion and anomaly detection:

```
CSV Upload → Pipeline Orchestrator → 5 Stages → Database Storage
```

### Pipeline Stages

| Stage | File | Purpose | Critical? |
|-------|------|---------|-----------|
| **1. Data Quality** | `data-quality.stage.ts` | Parse CSV, validate headers, check row validity | YES - halts pipeline |
| **2. Normalisation** | `normalisation.stage.ts` | Deduplicate rows, normalize ACoS format, recalculate metrics | NO |
| **3. Regime Detection** | `regime-detection.stage.ts` | Detect spending regime breakpoints | NO |
| **4. Anomaly Detection** | `anomaly-detection.stage.ts` | Rule-based + Z-score statistical anomaly detection | NO |
| **5. LLM Validation** | `llm-validation.stage.ts` | Claude AI enrichment, severity assignment | NO |

### Anomaly Types Detected

- `CLICKS_EXCEED_IMPRESSIONS` - Data corruption (impossible state)
- `SPEND_WITHOUT_CLICKS` - spend > 0 but clicks = 0
- `ACOS_SPIKE` - Z-score > 2.5 within regime
- `MONEY_LEAKAGE` - Sales down AND spend up (day-over-day)
- `ROAS_DROP_CRITICAL` - ROAS < 1 (losing money)
- `ROAS_DROP` - Z-score < -2 within regime
- `CVR_ANOMALY` - Significant CVR change
- `CTR_DROP` - CTR below baseline
- `ZERO_ACTIVITY_CAMPAIGN` - 7+ days with no activity

### Key Constants

```typescript
DEFAULT_ZSCORE_THRESHOLD = 2.5
DEFAULT_ZERO_ACTIVITY_DAYS = 7
CRITICAL_VALID_ROW_THRESHOLD = 0.5
LLM_BATCH_SIZE = 5
LLM_MAX_RETRIES = 3
LLM_MAX_TOKENS = 2000
TOP_ANOMALIES_PER_CAMPAIGN = 3
LLM_MODEL_VALIDATION = 'claude-haiku-4-5-20251001'
LLM_MODEL_DEEP_INSIGHT = 'claude-sonnet-4-6'
```

---

## Entities / Data Models

### Database Schema (PostgreSQL)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **reports** | Pipeline run metadata | `report_id`, `file_hash`, `filename`, `row_count`, `status`, `meta` |
| **anomalies** | Detected anomalies per report | `anomaly_id`, `report_id`, `campaign_id`, `date`, `anomaly_type`, `severity`, `label`, `count`, `feature_snapshot`, `status` |
| **audit_logs** | Audit trail for all actions | `log_id`, `report_id`, `anomaly_id`, `action`, `actor`, `llm_prompt`, `llm_response`, `llm_insight`, `meta` |

### TypeScript Interfaces

```typescript
interface Report {
  report_id: string;
  file_hash: string;
  filename: string;
  ingested_at: Date;
  row_count: number;
  status: string;
  meta: Record<string, unknown>;
}

interface Anomaly {
  anomaly_id: string;
  report_id: string;
  campaign_id: string;
  date: string | null;
  anomaly_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  label: string | null;
  count: number;
  feature_snapshot: Record<string, unknown>;
  status: 'open' | 'rejected' | 'approved' | 'investigating' | 'pending_insight';
  created_at: Date;
  updated_at: Date;
}

interface AuditLog {
  log_id: string;
  report_id: string | null;
  anomaly_id: string | null;
  action: string;
  actor: string;
  llm_prompt: string | null;
  llm_response: string | null;
  llm_insight: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  created_at: Date;
}
```

---

## API Reference

**Base URL:** `/api/v1`

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/anomaly/upload-csv` | `processData` | Upload CSV, run pipeline, store results |
| GET | `/anomaly` | `listAnomalies` | List anomalies with filters (pagination) |
| GET | `/anomaly/:id` | `getAnomaly` | Get single anomaly with audit logs |
| POST | `/anomaly/:id/reject` | `rejectAnomaly` | Mark anomaly as false positive |
| POST | `/anomaly/:id/approve` | `approveAnomaly` | Acknowledge anomaly |
| POST | `/anomaly/:id/increase-bid` | `increaseBid` | Mock bid increase action |
| POST | `/anomaly/:id/lower-bid` | `lowerBid` | Mock bid decrease action |
| GET | `/anomaly/audit-logs` | `listAuditLogs` | Get audit log entries |

---

## Frontend Architecture

```
src/frontend/src/
├── App.tsx                    # Root component with routing
├── main.tsx                   # React entry point
├── api/
│   └── client.ts              # Axios instance with interceptors
├── components/
│   └── anomalies/
│       ├── AnomalyCard.tsx     # Expandable anomaly card
│       ├── CampaignSection.tsx # Campaign grouping component
│       ├── CampaignAnomalyList.tsx # Campaign list with filters
│       └── SeverityBadge.tsx   # Severity indicator
├── hooks/
│   ├── useUpload.ts           # File upload state management
│   ├── useAnomalies.ts        # Anomaly CRUD operations
│   └── useCampaignAnomalies.ts # Group anomalies by campaign
├── pages/
│   ├── dropzone/              # Upload page
│   ├── anomalies/             # Anomaly list + detail view
│   └── insights/              # Campaign insights + audit logs
├── services/
│   ├── upload.service.ts      # CSV upload API call
│   └── anomalies.service.ts   # Anomaly CRUD API calls
└── types/
    └── index.ts               # Shared TypeScript types
```

### Routing

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<DropzonePage />} />
    <Route path="/anomalies" element={<AnomaliesPage />} />
    <Route path="/insights" element={<InsightsPage />} />
  </Routes>
</BrowserRouter>
```

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | DropzonePage | CSV file upload |
| `/anomalies` | AnomaliesPage | List anomalies with campaign grouping |
| `/insights` | InsightsPage | Campaign insights + audit logs |

### State Management

- React hooks (`useState`, `useCallback`, `useMemo`)
- Custom hooks: `useUpload`, `useAnomalies`, `useCampaignAnomalies`
- React Router for navigation with state passing

---

## Key Business Rules

1. **ACoS Normalization**: If value > 1, divide by 100 (percentage vs decimal conversion)
2. **Deduplication**: By `(campaign_id, date)` - keeps LAST occurrence
3. **Z-Score Calculation**: Within each regime, not across full dataset
4. **LLM Batching**: Top 3 anomalies per campaign sent to deep insight LLM
5. **NOT flagged**: `orders > clicks` (Amazon attribution window - expected behavior)
6. **Trust stored CPC**: Don't recalculate, ignore rounding differences

---

## Data Flow

### Upload Flow
1. User drops CSV file on Dropzone
2. `useUpload` hook uploads via `uploadCSV()` service
3. Backend runs 5-stage pipeline
4. Results stored in PostgreSQL (deduplicated by file hash)
5. Frontend receives `UploadResponse` with report + anomalies
6. Auto-navigates to Insights page with upload data

### Anomaly Processing Flow
1. CSV parsed and validated (data quality stage)
2. Rows normalized with ACoS fix + deduplication
3. Regimes detected (breakpoints for statistical context)
4. Anomalies detected via rules + z-scores
5. LLM (Claude Haiku) validates and enriches findings
6. Top 3 per campaign sent to LLM deep insight, rest marked `[PENDING]`
7. Final anomalies grouped by campaign