import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InsightsPage } from './index';
import type { Anomaly } from '../../services/anomalies.service';

vi.mock('../../services/anomalies.service', () => ({
  listAnomalies: vi.fn(),
  listAuditLogs: vi.fn(),
}));

import { listAnomalies, listAuditLogs } from '../../services/anomalies.service';

const mockAnomalies: Anomaly[] = [
  {
    anomaly_id: 'a1',
    report_id: 'r1',
    campaign_id: 'C1',
    date: '2025-01-01',
    anomaly_type: 'acos_spike',
    severity: 'CRITICAL',
    label: 'Critical ACoS Spike',
    count: 1,
    feature_snapshot: {
      insight: 'ACoS jumped significantly',
      acos: 0.19,
      roas: 2,
      spend: 100,
      confidence: 0.95,
    },
    status: 'open',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const renderWithState = (initialState: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/insights', state: initialState }]}>
      <Routes>
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/" element={<div>Upload page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  (listAuditLogs as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    requestId: 'r',
    data: { logs: [], total: 0 },
  });
});

describe('InsightsPage — security regression: do not trust location.state.uploadData', () => {
  it('renders AuditLogView when location.state is null', async () => {
    renderWithState(null);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
    expect(listAnomalies).not.toHaveBeenCalled();
  });

  it('renders AuditLogView when location.state has no reportId', async () => {
    renderWithState({});
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
    expect(listAnomalies).not.toHaveBeenCalled();
  });

  it('ignores attacker-supplied uploadData in location.state (security regression)', async () => {
    const maliciousUploadData = {
      report: {
        id: 'malicious',
        totalRows: 9999,
        validRows: 9999,
        regimesDetected: 0,
        anomaliesFound: 9999,
        bySeverity: { CRITICAL: 9999, HIGH: 0, MEDIUM: 0, LOW: 0 },
        processingTime_ms: 0,
      },
      anomaliesByCampaign: {
        C_HACKED: [
          {
            id: 'h1',
            campaignId: 'C_HACKED',
            date: '2025-01-01',
            type: 'fake',
            severity: 'CRITICAL',
            title: 'Injected',
            insight: 'attacker',
            suggestedAction: '',
            confidence: 1,
            metadata: {},
          },
        ],
      },
    };

    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      requestId: 'r',
      data: { anomalies: mockAnomalies, total: mockAnomalies.length },
    });

    renderWithState({ uploadData: maliciousUploadData });

    await waitFor(() => {
      expect(screen.queryByText('Injected')).not.toBeInTheDocument();
    });
    expect(listAnomalies).not.toHaveBeenCalled();
  });

  it('falls back to AuditLogView when reportId is non-string', async () => {
    renderWithState({ reportId: 12345 });
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
    expect(listAnomalies).not.toHaveBeenCalled();
  });
});

describe('InsightsPage — fetches report by reportId', () => {
  it('shows loading state while fetching', () => {
    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithState({ reportId: 'r1' });

    expect(screen.getByRole('status')).toHaveTextContent(/Loading report/i);
  });

  it('fetches anomalies using the reportId from location.state', async () => {
    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      requestId: 'r',
      data: { anomalies: mockAnomalies, total: mockAnomalies.length },
    });

    renderWithState({ reportId: 'r1' });

    await waitFor(() => {
      expect(listAnomalies).toHaveBeenCalledWith(
        expect.objectContaining({ reportId: 'r1' })
      );
    });
  });

  it('renders ResultsDashboard after successful fetch', async () => {
    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      requestId: 'r',
      data: { anomalies: mockAnomalies, total: mockAnomalies.length },
    });

    renderWithState({ reportId: 'r1' });

    await waitFor(() => {
      expect(screen.getByText('Anomaly detection')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Critical ACoS Spike').length).toBeGreaterThan(0);
  });

  it('shows error state when fetch fails', async () => {
    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network down')
    );

    renderWithState({ reportId: 'r1' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network down/);
    });
  });

  it('shows error when no anomalies are returned for the reportId', async () => {
    (listAnomalies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      requestId: 'r',
      data: { anomalies: [], total: 0 },
    });

    renderWithState({ reportId: 'unknown' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No anomalies/);
    });
  });
});
