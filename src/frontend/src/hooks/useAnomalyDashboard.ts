import { useState, useCallback, useMemo } from 'react';
import type { UploadResponse } from '../types';
import type { AnomalyWithStatus, AnomalyStatus, CampaignGroup, AnomalySeverity } from '../types/anomaly';

const severityWeight: Record<AnomalySeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const inferScore = (confidence: number, severity: AnomalySeverity): number => {
  const base = Math.round(confidence * 100);
  const boost = severity === 'CRITICAL' ? 20 : severity === 'HIGH' ? 10 : 0;
  return Math.min(100, base + boost);
};

const inferMetrics = (
  metadata: Record<string, unknown>
): { acos: number; roas: number; spend: number } => {
  return {
    acos: Number(metadata.acos ?? metadata.ACoS ?? 0),
    roas: Number(metadata.roas ?? metadata.ROAS ?? 0),
    spend: Number(metadata.spend ?? metadata.Spend ?? 0),
  };
};

const inferSignal = (type: string, metadata: Record<string, unknown>): string => {
  const acos = Number(metadata.acos ?? metadata.ACoS);
  const roas = Number(metadata.roas ?? metadata.ROAS);
  if (Number.isFinite(acos) && acos > 0) {
    return `ACoS ${(acos * 100).toFixed(1)}%`;
  }
  if (Number.isFinite(roas) && roas > 0) {
    return `ROAS ${roas.toFixed(2)}`;
  }
  return type.replace(/_/g, ' ');
};

export const useAnomalyDashboard = (data: UploadResponse) => {
  const initial = useMemo<AnomalyWithStatus[]>(() => {
    return Object.values(data.anomaliesByCampaign)
      .flat()
      .map((a) => ({
        id: a.id,
        campaignId: a.campaignId,
        date: a.date,
        type: a.type,
        severity: a.severity,
        title: a.title || a.type.replace(/_/g, ' '),
        insight: a.insight,
        description: a.insight,
        suggestedAction: a.suggestedAction,
        confidence: a.confidence,
        score: inferScore(a.confidence, a.severity),
        signal: inferSignal(a.type, a.metadata),
        metrics: inferMetrics(a.metadata),
        metadata: a.metadata,
        status: 'pending' as AnomalyStatus,
      }));
  }, [data]);

  const [anomalies, setAnomalies] = useState<AnomalyWithStatus[]>(initial);

  const setStatus = useCallback((id: string, status: AnomalyStatus) => {
    setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const setStatusBulk = useCallback((ids: string[], status: AnomalyStatus) => {
    const idSet = new Set(ids);
    setAnomalies((prev) =>
      prev.map((a) => (idSet.has(a.id) ? { ...a, status } : a))
    );
  }, []);

  const groups = useMemo<CampaignGroup[]>(() => {
    const map = new Map<string, AnomalyWithStatus[]>();
    anomalies.forEach((a) => {
      const arr = map.get(a.campaignId) || [];
      arr.push(a);
      map.set(a.campaignId, arr);
    });
    return Array.from(map.entries())
      .map(([campaignId, items]) => {
        const sorted = [...items].sort(
          (a, b) => severityWeight[a.severity] - severityWeight[b.severity]
        );
        return {
          campaignId,
          anomalies: sorted,
          topSeverity: sorted[0]?.severity || 'LOW',
          pendingCount: items.filter((a) => a.status === 'pending').length,
        };
      })
      .sort((a, b) => severityWeight[a.topSeverity] - severityWeight[b.topSeverity]);
  }, [anomalies]);

  const metrics = useMemo(() => {
    const total = anomalies.length;
    const critical = anomalies.filter((a) => a.severity === 'CRITICAL').length;
    const pending = anomalies.filter((a) => a.status === 'pending').length;
    const resolved = total - pending;
    return { total, critical, pending, resolved };
  }, [anomalies]);

  const top5 = useMemo(() => {
    return [...anomalies]
      .filter((a) => a.status === 'pending')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [anomalies]);

  const severityDistribution = useMemo(() => {
    return {
      CRITICAL: anomalies.filter((a) => a.severity === 'CRITICAL').length,
      HIGH: anomalies.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: anomalies.filter((a) => a.severity === 'MEDIUM').length,
    };
  }, [anomalies]);

  return {
    anomalies,
    groups,
    metrics,
    top5,
    severityDistribution,
    setStatus,
    setStatusBulk,
    report: data.report,
  };
};