import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Top5Ranking } from './Top5Ranking';
import type { AnomalyWithStatus } from '../../types/anomaly';

const mockAnomalies: AnomalyWithStatus[] = [
  {
    id: 'a1',
    campaignId: 'C1',
    date: '2025-01-01',
    type: 'acos_spike',
    severity: 'CRITICAL',
    title: 'ACoS Spike',
    insight: 'insight',
    description: 'desc',
    suggestedAction: 'action',
    confidence: 0.95,
    score: 95,
    signal: 'ACoS 8% → 19%',
    metrics: { acos: 0.19, roas: 2, spend: 100 },
    metadata: {},
    status: 'pending',
  },
  {
    id: 'a2',
    campaignId: 'C2',
    date: '2025-01-02',
    type: 'spend_leak',
    severity: 'HIGH',
    title: 'Spend Leak',
    insight: 'insight',
    description: 'desc',
    suggestedAction: 'action',
    confidence: 0.8,
    score: 80,
    signal: 'Spend +30%',
    metrics: { acos: 0, roas: 0, spend: 0 },
    metadata: {},
    status: 'pending',
  },
];

describe('Top5Ranking', () => {
  it('renders the title', () => {
    render(<Top5Ranking anomalies={mockAnomalies} />);
    expect(screen.getByText('Top 5 critical anomalies')).toBeInTheDocument();
  });

  it('renders rank numbers', () => {
    render(<Top5Ranking anomalies={mockAnomalies} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders anomaly names', () => {
    render(<Top5Ranking anomalies={mockAnomalies} />);
    expect(screen.getByText('ACoS Spike')).toBeInTheDocument();
    expect(screen.getByText('Spend Leak')).toBeInTheDocument();
  });

  it('renders score values', () => {
    render(<Top5Ranking anomalies={mockAnomalies} />);
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('shows empty state when no anomalies', () => {
    render(<Top5Ranking anomalies={[]} />);
    expect(screen.getByText(/No pending critical anomalies/i)).toBeInTheDocument();
  });
});