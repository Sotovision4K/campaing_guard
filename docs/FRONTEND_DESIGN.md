# Profasee Frontend Design Specification

## Overview

A light, intuitive interface for the Amazon PPC campaign anomaly detection tool. Focus on clarity, smooth transitions, and providing immediate feedback during file processing.

---

## Design Principles

1. **Light & Airy** - Generous whitespace, soft shadows, light color palette
2. **Immediate Feedback** - Users always know what's happening via state transitions
3. **Information Hierarchy** - Critical data (anomalies, severity) surfaces prominently
4. **Zero Decision Fatigue** - Clear visual grouping, no overwhelming tables upfront

---

## Color Palette

```css
:root {
  /* Primary */
  --color-primary: #4F46E5;        /* Indigo - main actions */
  --color-primary-hover: #4338CA;
  --color-primary-light: #EEF2FF;

  /* Severity */
  --color-critical: #DC2626;       /* Red */
  --color-critical-bg: #FEF2F2;
  --color-high: #EA580C;          /* Orange */
  --color-high-bg: #FFF7ED;
  --color-medium: #CA8A04;        /* Yellow */
  --color-medium-bg: #FEFCE8;
  --color-low: #16A34A;           /* Green */
  --color-low-bg: #F0FDF4;

  /* Neutrals */
  --color-bg: #F8FAFC;             /* Page background */
  --color-surface: #FFFFFF;        /* Cards, panels */
  --color-border: #E2E8F0;
  --color-text-primary: #1E293B;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;

  /* Status */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
}
```

---

## Typography

```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 15px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
}
```

---

## Spacing & Layout

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
}
```

---

## Component Specifications

### 1. Navigation Bar

**Appearance:**
- Height: 64px, sticky top
- Background: white with subtle bottom border
- Brand logo left-aligned
- Nav links right-aligned with active indicator

**States:**
- Default: text-secondary color
- Hover: text-primary with underline animation
- Active: text-primary with pill background (primary-light)

### 2. Dropzone Component

**Appearance:**
- Border: 2px dashed border-color
- Background: surface color
- Border-radius: lg (16px)
- Padding: space-10 (48px)
- Centered content with icon + text

**States:**
| State | Border | Background | Icon Color | Description |
|-------|--------|------------|------------|-------------|
| Idle | border | surface | text-muted | "Drop CSV or click to browse" |
| Hover | primary | primary-light (subtle) | primary | Border becomes solid |
| Drag Active | primary | primary-light | primary | "Drop file here..." |
| Disabled | border | transparent | text-muted | 50% opacity |

**Transitions:** All state changes animate over 200ms ease-out

### 3. Upload Progress Component

**Layout:**
- File info row: icon + filename + size
- Progress bar: full width, 8px height, rounded
- Percentage + stage label below

**Appearance:**
- Progress bar: gradient from primary to primary-hover
- Stage indicator: small text below showing current pipeline stage

**Pipeline Stages Display:**
```
[1. Data Quality] → [2. Normalisation] → [3. Regime Detection] → [4. Anomaly Detection] → [5. LLM Validation]
```
Each stage lights up as it completes. Current stage pulses gently.

**Animation:**
- Progress bar fills with smooth 300ms transition
- Stage indicator fades between stages
- Subtle pulse animation on current stage

### 4. Summary Cards

**Layout:** 4-column grid on desktop, 2-column on tablet, 1-column on mobile

**Card Types:**

| Card | Icon | Background | Use Case |
|------|------|------------|----------|
| Total Rows | Database | neutral | Raw data count |
| Valid Rows | CheckCircle | success-bg | Clean data percentage |
| Regimes | GitBranch | info-bg | Spending patterns detected |
| Anomalies | AlertTriangle | (color varies by severity) | Total findings |

**Animation:** Cards slide up with stagger (100ms each) on mount

### 5. Severity Breakdown

**Layout:** Horizontal bar showing distribution

**Visual:** Stacked horizontal bar with percentage segments
```
[CRITICAL: 3][HIGH: 8][MEDIUM: 12][LOW: 5]
```
Each segment has proportional width based on count.

**Cards below:** 4 severity cards in a row with:
- Count (large, bold)
- Label (small, uppercase)
- Subtle left border in severity color

### 6. Anomaly Type Distribution

**Chart:** Horizontal bar chart showing count by type

**Visual:**
- Each anomaly type as a row
- Bar extends from left with count label at end
- Color-coded by severity of that anomaly type
- Sorted by count descending

### 7. Campaign List

**Layout:** Scrollable list with expandable cards

**Card Appearance:**
- Campaign name (bold)
- Anomaly count badge
- Expand/collapse chevron
- Subtle hover lift effect

**Expanded State:**
- List of anomalies for that campaign
- Each anomaly shows: type, severity badge, date
- Click to view detail

---

## Page Layouts

### Upload Page (`/`)

```
┌─────────────────────────────────────────────┐
│ [Nav Bar]                                   │
├─────────────────────────────────────────────┤
│                                             │
│         ┌─────────────────────┐             │
│         │                     │             │
│         │      DROPZONE       │             │
│         │                     │             │
│         └─────────────────────┘             │
│                                             │
│         "Upload Campaign Data"              │
│         "Drag & drop or click to select"    │
│                                             │
└─────────────────────────────────────────────┘
```

**Processing State:**
```
┌─────────────────────────────────────────────┐
│ [Nav Bar]                                   │
├─────────────────────────────────────────────┤
│                                             │
│         ┌─────────────────────┐             │
│         │  📄 campaign.csv    │             │
│         │  ▓▓▓▓▓▓░░░░░ 68%    │             │
│         │  Stage 3 of 5...    │             │
│         └─────────────────────┘             │
│                                             │
│   ● Data Quality → ○ Normalisation →        │
│   ○ Regime Detection → ○ Anomaly →         │
│   ○ LLM Validation                          │
│                                             │
└─────────────────────────────────────────────┘
```

### Results Preview (after upload)

```
┌─────────────────────────────────────────────┐
│ [Nav Bar]                                   │
├─────────────────────────────────────────────┤
│                                             │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│   │ 2,847  │ │ 2,812  │ │   3    │ │  23    ││
│   │ Total  │ │ Valid  │ │ Regimes│ │Anomalies│
│   └────────┘ └────────┘ └────────┘ └────────┘│
│                                             │
│   Severity Breakdown                        │
│   [████████████████████████████] 23 total   │
│   CRIT: 2  HIGH: 5  MED: 8  LOW: 8          │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │ Anomaly Type Distribution           │   │
│   │ SPEND_WITHOUT_CLICKS    ███████ 12  │   │
│   │ ROAS_DROP               ████   5    │   │
│   │ ACOS_SPIKE              ███    4     │   │
│   │ CTR_DROP                ██     2     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Campaigns with Anomalies (5)              │
│   ┌─────────────────────────────────────┐   │
│   │ ▶ Campaign Alpha          6 anomalies│   │
│   │ ▶ Campaign Beta           4 anomalies│   │
│   │ ▶ Campaign Gamma          3 anomalies│   │
│   └─────────────────────────────────────┘   │
│                                             │
│   [View Full Report →]                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Single column, stacked cards |
| Tablet | 640px - 1024px | 2-column grids, collapsible sections |
| Desktop | > 1024px | Full layout, 4-column stat cards |

---

## Animation Specifications

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| Fade In | 200ms | ease-out | State changes |
| Slide Up | 300ms | ease-out | Cards appearing |
| Progress Fill | 300ms | ease-in-out | Progress bar |
| Pulse | 1.5s | ease-in-out | Current stage indicator |
| Hover Lift | 150ms | ease-out | Card hover |
| Stagger | 100ms | - | Card grid entrance |

---

## States Summary

### Upload Flow States

1. **idle** - Dropzone ready, waiting for file
2. **uploading** - File being uploaded with progress
3. **processing** - Backend running pipeline stages (with stage indicator)
4. **success** - Results preview with summary cards
5. **error** - Error message with retry option
6. **cached** - Brief "already processed" notification

### Severity States

| Severity | Color | Background | Icon |
|----------|-------|------------|------|
| CRITICAL | #DC2626 | #FEF2F2 | AlertOctagon |
| HIGH | #EA580C | #FFF7ED | AlertTriangle |
| MEDIUM | #CA8A04 | #FEFCE8 | AlertCircle |
| LOW | #16A34A | #F0FDF4 | Info |

---

## Component Props Interface

```typescript
// Severity Badge
interface SeverityBadgeProps {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  count?: number;
  showIcon?: boolean;
}

// Summary Card
interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'error';
}

// Pipeline Progress
interface PipelineProgressProps {
  currentStage: number; // 1-5
  progress: number; // 0-100
  stageLabels?: string[];
}

// Anomaly Chart Bar
interface AnomalyTypeBarProps {
  type: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}
```

---

## Implementation Notes

1. **Use Tailwind CSS** for utility-first styling with CSS variables for theming
2. **Use Framer Motion** or CSS animations for smooth transitions
3. **Recharts** library for bar charts and data visualization
4. **Focus on accessibility** - proper ARIA labels, keyboard navigation
5. **Mobile-first responsive** design approach