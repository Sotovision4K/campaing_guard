import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnomalyDashboard } from './useAnomalyDashboard';
import type { UploadResponse } from '../types';

const mockData: UploadResponse = {
  report: {
    id: 'r1',
    totalRows: 100,
    validRows: 95,
    regimesDetected: 2,
    anomaliesFound: 3,
    bySeverity: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 0 },
    processingTime_ms: 1000,
  },
  anomaliesByCampaign: {
    C1: [
      {
        id: 'a1', campaignId: 'C1', date: '2025-01-01', type: 'acos_spike', severity: 'CRITICAL',
        title: 'Critical Anomaly', insight: 'i', suggestedAction: 's', confidence: 0.95,
        metadata: { acos: 0.19, roas: 2, spend: 100 },
      },
      {
        id: 'a2', campaignId: 'C1', date: '2025-01-02', type: 'leak', severity: 'HIGH',
        title: 'High Anomaly', insight: 'i', suggestedAction: 's', confidence: 0.8,
        metadata: { acos: 0.15, roas: 3, spend: 50 },
      },
    ],
    C2: [
      {
        id: 'a3', campaignId: 'C2', date: '2025-01-03', type: 'ctr', severity: 'MEDIUM',
        title: 'Medium Anomaly', insight: 'i', suggestedAction: 's', confidence: 0.5,
        metadata: { acos: 0.10, roas: 4, spend: 25 },
      },
    ],
  },
};

describe('useAnomalyDashboard', () => {
  it('initializes all anomalies as pending', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    expect(result.current.anomalies.every((a) => a.status === 'pending')).toBe(true);
  });

  it('calculates initial metrics', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    expect(result.current.metrics).toEqual({
      total: 3,
      critical: 1,
      pending: 3,
      resolved: 0,
    });
  });

  it('groups anomalies by campaign', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0].campaignId).toBe('C1');
    expect(result.current.groups[0].anomalies).toHaveLength(2);
  });

  it('updates status when setStatus is called', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));

    act(() => {
      result.current.setStatus('a1', 'approved');
    });

    const updated = result.current.anomalies.find((a) => a.id === 'a1');
    expect(updated?.status).toBe('approved');
  });

  it('updates metrics after status change', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));

    act(() => {
      result.current.setStatus('a1', 'approved');
      result.current.setStatus('a2', 'rejected');
    });

    expect(result.current.metrics).toEqual({
      total: 3,
      critical: 1,
      pending: 1,
      resolved: 2,
    });
  });

  it('handles bulk status updates', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));

    act(() => {
      result.current.setStatusBulk(['a1', 'a2'], 'approved');
    });

    expect(result.current.metrics.resolved).toBe(2);
    expect(result.current.metrics.pending).toBe(1);
  });

  it('returns top 5 pending anomalies sorted by score', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    expect(result.current.top5).toHaveLength(3);
    expect(result.current.top5[0].score).toBeGreaterThanOrEqual(result.current.top5[1].score);
  });

  it('excludes approved/rejected from top5', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));

    act(() => {
      result.current.setStatus('a1', 'approved');
    });

    expect(result.current.top5.find((a) => a.id === 'a1')).toBeUndefined();
  });

  it('calculates severity distribution', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    expect(result.current.severityDistribution).toEqual({
      CRITICAL: 1,
      HIGH: 1,
      MEDIUM: 1,
    });
  });

  it('infers metrics from metadata', () => {
    const { result } = renderHook(() => useAnomalyDashboard(mockData));
    const a1 = result.current.anomalies.find((a) => a.id === 'a1');
    expect(a1?.metrics.acos).toBe(0.19);
    expect(a1?.metrics.roas).toBe(2);
    expect(a1?.metrics.spend).toBe(100);
  });
});