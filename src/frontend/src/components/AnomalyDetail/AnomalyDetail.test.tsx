import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyDetail, AnomalyDetailEmpty } from './AnomalyDetail';
import type { AnomalyWithStatus } from '../../types/anomaly';

const baseAnomaly: AnomalyWithStatus = {
  id: 'a1',
  campaignId: 'C1',
  date: '2025-01-01',
  type: 'acos_spike',
  severity: 'CRITICAL',
  title: 'Critical ACoS Spike',
  insight: 'ACoS jumped significantly',
  description: 'ACoS jumped from 8% to 19% in 24 hours',
  suggestedAction: 'Lower bids',
  confidence: 0.95,
  score: 95,
  signal: 'ACoS 8% → 19%',
  metrics: { acos: 0.19, roas: 2, spend: 100 },
  metadata: {},
  status: 'pending',
};

describe('AnomalyDetail', () => {
  it('renders anomaly title and campaign tag', () => {
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );
    expect(screen.getByText('Critical ACoS Spike')).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
  });

  it('shows action buttons when pending', () => {
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );
    expect(screen.getByText(/Approve/i)).toBeInTheDocument();
    expect(screen.getByText(/Reject/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyze/i)).toBeInTheDocument();
  });

  it('shows approved chip when status is approved', () => {
    render(
      <AnomalyDetail
        anomaly={{ ...baseAnomaly, status: 'approved' }}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );
    expect(screen.getByText('✓ Approved')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('calls onApprove when Approve is clicked', async () => {
    const user = userEvent.setup();
    const handleApprove = vi.fn();
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={handleApprove}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );

    await user.click(screen.getByText(/^✓ Approve/));
    expect(handleApprove).toHaveBeenCalledWith('a1');
  });

  it('calls onReject when Reject is clicked', async () => {
    const user = userEvent.setup();
    const handleReject = vi.fn();
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={handleReject}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );

    await user.click(screen.getByText(/^✕ Reject/));
    expect(handleReject).toHaveBeenCalledWith('a1');
  });

  it('calls onUndo when Undo is clicked', async () => {
    const user = userEvent.setup();
    const handleUndo = vi.fn();
    render(
      <AnomalyDetail
        anomaly={{ ...baseAnomaly, status: 'approved' }}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={handleUndo}
        onAnalyze={() => {}}
      />
    );

    await user.click(screen.getByText('Undo'));
    expect(handleUndo).toHaveBeenCalledWith('a1');
  });

  it('calls onAnalyze when Analyze is clicked', async () => {
    const user = userEvent.setup();
    const handleAnalyze = vi.fn();
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={handleAnalyze}
      />
    );

    await user.click(screen.getByText(/Analyze/));
    expect(handleAnalyze).toHaveBeenCalledWith('a1');
  });

  it('shows Adjust bid toggle and reveals bid controls when clicked', async () => {
    const user = userEvent.setup();
    const handleIncrease = vi.fn();
    const handleLower = vi.fn();
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
        onIncreaseBid={handleIncrease}
        onLowerBid={handleLower}
      />
    );

    await user.click(screen.getByText(/Adjust bid/));
    expect(screen.getByText(/Increase bid/)).toBeInTheDocument();
    expect(screen.getByText(/Lower bid/)).toBeInTheDocument();

    await user.click(screen.getByText(/Increase bid/));
    expect(handleIncrease).toHaveBeenCalledWith('a1', 10);
  });

  it('hides bid controls when onIncreaseBid/onLowerBid are not provided', () => {
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );
    expect(screen.queryByText(/Adjust bid/)).not.toBeInTheDocument();
  });

  it('renders KPI tiles with values', () => {
    render(
      <AnomalyDetail
        anomaly={baseAnomaly}
        onApprove={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onAnalyze={() => {}}
      />
    );
    expect(screen.getByText('ACoS')).toBeInTheDocument();
    expect(screen.getByText('ROAS')).toBeInTheDocument();
    expect(screen.getByText('Spend')).toBeInTheDocument();
    expect(screen.getByText('19.0%')).toBeInTheDocument();
  });
});

describe('AnomalyDetailEmpty', () => {
  it('shows empty state message', () => {
    render(<AnomalyDetailEmpty />);
    expect(screen.getByText(/Select an anomaly to inspect/i)).toBeInTheDocument();
  });
});