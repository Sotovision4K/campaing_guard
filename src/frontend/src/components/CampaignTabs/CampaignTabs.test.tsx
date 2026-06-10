import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignTabs } from './CampaignTabs';
import type { CampaignGroup } from '../../types/anomaly';

const mockGroups: CampaignGroup[] = [
  {
    campaignId: 'Alpha',
    topSeverity: 'CRITICAL',
    pendingCount: 2,
    anomalies: [
      {
        id: 'a1', campaignId: 'Alpha', date: '2025-01-01', type: 't', severity: 'CRITICAL',
        title: 't1', insight: 'i', description: 'd', suggestedAction: 's', confidence: 1, score: 100,
        signal: 'sig', metrics: { acos: 0, roas: 0, spend: 0 }, metadata: {}, status: 'pending',
      },
      {
        id: 'a2', campaignId: 'Alpha', date: '2025-01-02', type: 't', severity: 'HIGH',
        title: 't2', insight: 'i', description: 'd', suggestedAction: 's', confidence: 0.8, score: 80,
        signal: 'sig', metrics: { acos: 0, roas: 0, spend: 0 }, metadata: {}, status: 'pending',
      },
    ],
  },
  {
    campaignId: 'Beta',
    topSeverity: 'MEDIUM',
    pendingCount: 1,
    anomalies: [
      {
        id: 'a3', campaignId: 'Beta', date: '2025-01-03', type: 't', severity: 'MEDIUM',
        title: 't3', insight: 'i', description: 'd', suggestedAction: 's', confidence: 0.5, score: 50,
        signal: 'sig', metrics: { acos: 0, roas: 0, spend: 0 }, metadata: {}, status: 'pending',
      },
    ],
  },
];

describe('CampaignTabs', () => {
  it('renders All campaigns tab plus one tab per campaign', () => {
    render(<CampaignTabs groups={mockGroups} activeCampaignId={null} onSelect={() => {}} />);
    expect(screen.getByText('All campaigns')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows total counts on tabs', () => {
    render(<CampaignTabs groups={mockGroups} activeCampaignId={null} onSelect={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected', () => {
    render(<CampaignTabs groups={mockGroups} activeCampaignId="Alpha" onSelect={() => {}} />);
    const alphaTab = screen.getByRole('tab', { name: /Alpha/i });
    expect(alphaTab).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onSelect with null when All campaigns clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(<CampaignTabs groups={mockGroups} activeCampaignId="Alpha" onSelect={handleSelect} />);

    await user.click(screen.getByText('All campaigns'));
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with campaign id when tab clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(<CampaignTabs groups={mockGroups} activeCampaignId={null} onSelect={handleSelect} />);

    await user.click(screen.getByText('Beta'));
    expect(handleSelect).toHaveBeenCalledWith('Beta');
  });

  it('returns null when no groups', () => {
    const { container } = render(
      <CampaignTabs groups={[]} activeCampaignId={null} onSelect={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});