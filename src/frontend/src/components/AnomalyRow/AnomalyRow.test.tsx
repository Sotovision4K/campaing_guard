import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyRow } from './AnomalyRow';
import type { AnomalyWithStatus } from '../../types/anomaly';

const baseAnomaly: AnomalyWithStatus = {
  id: 'a1',
  campaignId: 'C1',
  date: '2025-01-01',
  type: 'acos_spike',
  severity: 'CRITICAL',
  title: 'ACoS Spike',
  insight: 'insight',
  description: 'desc',
  suggestedAction: 'action',
  confidence: 0.9,
  score: 90,
  signal: 'ACoS 8% → 19%',
  metrics: { acos: 0.19, roas: 2, spend: 100 },
  metadata: {},
  status: 'pending',
};

describe('AnomalyRow', () => {
  it('renders anomaly name and signal', () => {
    render(<AnomalyRow anomaly={baseAnomaly} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('ACoS Spike')).toBeInTheDocument();
    expect(screen.getByText('ACoS 8% → 19%')).toBeInTheDocument();
  });

  it('shows severity badge when pending', () => {
    render(<AnomalyRow anomaly={baseAnomaly} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('shows approved chip when status is approved', () => {
    const approved = { ...baseAnomaly, status: 'approved' as const };
    render(<AnomalyRow anomaly={approved} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('✓ Approved')).toBeInTheDocument();
  });

  it('shows rejected chip when status is rejected', () => {
    const rejected = { ...baseAnomaly, status: 'rejected' as const };
    render(<AnomalyRow anomaly={rejected} selected={false} onSelect={() => {}} />);
    expect(screen.getByText('✕ Rejected')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(<AnomalyRow anomaly={baseAnomaly} selected={false} onSelect={handleSelect} />);

    const row = screen.getByRole('row');
    await user.click(row);

    expect(handleSelect).toHaveBeenCalledWith('a1');
  });

  it('applies selected class when selected', () => {
    const { container } = render(
      <AnomalyRow anomaly={baseAnomaly} selected={true} onSelect={() => {}} />
    );
    const button = container.querySelector('button[role="row"]');
    expect(button?.className).toContain('selected');
  });
});