import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  listAnomalies,
  approveAnomaly,
  rejectAnomaly,
  bulkActionAnomalies,
  increaseBid as increaseBidRequest,
  lowerBid as lowerBidRequest,
} from '../../services/anomalies.service';
import type { Anomaly } from '../../services/anomalies.service';
import type { AnomalyWithStatus, AnomalyStatus } from '../../types/anomaly';
import { TopBar } from '../../components/TopBar/TopBar';
import { SummaryMetrics } from '../../components/SummaryMetrics/SummaryMetrics';
import { CampaignTabs } from '../../components/CampaignTabs/CampaignTabs';
import { AnomalyGroup } from '../../components/AnomalyGroup/AnomalyGroup';
import { AnomalyDetail, AnomalyDetailEmpty } from '../../components/AnomalyDetail/AnomalyDetail';
import { Top5Ranking } from '../../components/Top5Ranking/Top5Ranking';
import { SeverityDonut } from '../../components/SeverityDonut/SeverityDonut';
import styles from './Anomalies.module.css';

const mapStatus = (status: Anomaly['status']): AnomalyStatus => {
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
};

const inferScore = (anomaly: Anomaly): number => {
  const base = Math.min(100, anomaly.count * 10);
  const boost = anomaly.severity === 'CRITICAL' ? 30 : anomaly.severity === 'HIGH' ? 20 : 10;
  return Math.min(100, base + boost);
};

const inferMetrics = (
  snapshot: Record<string, unknown>
): { acos: number; roas: number; spend: number } => {
  return {
    acos: Number(snapshot.acos ?? snapshot.ACoS ?? 0),
    roas: Number(snapshot.roas ?? snapshot.ROAS ?? 0),
    spend: Number(snapshot.spend ?? snapshot.Spend ?? 0),
  };
};

const inferSignal = (type: string, snapshot: Record<string, unknown>): string => {
  const acos = Number(snapshot.acos ?? snapshot.ACoS);
  if (Number.isFinite(acos) && acos > 0) {
    return `ACoS ${(acos * 100).toFixed(1)}%`;
  }
  return type.replace(/_/g, ' ');
};

const toAnomalyWithStatus = (a: Anomaly): AnomalyWithStatus => ({
  id: a.anomaly_id,
  campaignId: a.campaign_id,
  date: a.date || '',
  type: a.anomaly_type,
  severity: a.severity,
  title: a.label || a.anomaly_type.replace(/_/g, ' '),
  insight: typeof a.feature_snapshot?.insight === 'string' ? a.feature_snapshot.insight : '',
  description: typeof a.feature_snapshot?.description === 'string' ? a.feature_snapshot.description : '',
  suggestedAction: typeof a.feature_snapshot?.action === 'string' ? a.feature_snapshot.action : '',
  confidence: Number(a.feature_snapshot?.confidence ?? 0.5),
  score: inferScore(a),
  signal: inferSignal(a.anomaly_type, a.feature_snapshot),
  metrics: inferMetrics(a.feature_snapshot),
  metadata: a.feature_snapshot,
  status: mapStatus(a.status),
});

export const AnomaliesPage = () => {
  const [anomalies, setAnomalies] = useState<AnomalyWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAnomalies({ limit: 200 });
      setAnomalies(response.data.anomalies.map(toAnomalyWithStatus));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, []);

  const persistStatus = useCallback((id: string, status: AnomalyWithStatus['status']) => {
    if (status === 'approved') void approveAnomaly(id);
    else if (status === 'rejected') void rejectAnomaly(id);
  }, []);

  const persistStatusBulk = useCallback((ids: string[], status: AnomalyWithStatus['status']) => {
    if (status === 'approved' || status === 'rejected') {
      void bulkActionAnomalies(ids, status);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnomalies();
  }, [fetchAnomalies]);

  const groups = useMemo(() => {
    const map = new Map<string, AnomalyWithStatus[]>();
    anomalies.forEach((a) => {
      const arr = map.get(a.campaignId) || [];
      arr.push(a);
      map.set(a.campaignId, arr);
    });
    const severityWeight = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
    return Array.from(map.entries())
      .map(([campaignId, items]) => ({
        campaignId,
        anomalies: items,
        topSeverity: items[0]?.severity || 'LOW',
        pendingCount: items.filter((a) => a.status === 'pending').length,
      }))
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

  const severityDistribution = useMemo(() => ({
    CRITICAL: anomalies.filter((a) => a.severity === 'CRITICAL').length,
    HIGH: anomalies.filter((a) => a.severity === 'HIGH').length,
    MEDIUM: anomalies.filter((a) => a.severity === 'MEDIUM').length,
  }), [anomalies]);

  const visibleGroups = useMemo(() => {
    if (activeCampaignId === null) return groups;
    return groups.filter((g) => g.campaignId === activeCampaignId);
  }, [groups, activeCampaignId]);

  const selectedAnomaly = useMemo(() => {
    if (!selectedAnomalyId) return null;
    for (const group of groups) {
      const found = group.anomalies.find((a) => a.id === selectedAnomalyId);
      if (found) return found;
    }
    return null;
  }, [groups, selectedAnomalyId]);

  const handleStatusChange = useCallback((id: string, newStatus: AnomalyStatus) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    persistStatus(id, newStatus);
  }, [persistStatus]);

  const handleStatusChangeBulk = useCallback((ids: string[], newStatus: AnomalyStatus) => {
    const idSet = new Set(ids);
    setAnomalies((prev) =>
      prev.map((a) => (idSet.has(a.id) ? { ...a, status: newStatus } : a))
    );
    persistStatusBulk(ids, newStatus);
  }, [persistStatusBulk]);

  const handleTabChange = (id: string | null) => {
    setActiveCampaignId(id);
    setSelectedAnomalyId(null);
  };

  const handleApprove = (id: string) => handleStatusChange(id, 'approved');
  const handleReject = (id: string) => handleStatusChange(id, 'rejected');
  const handleUndo = (id: string) => handleStatusChange(id, 'pending');
  const handleAnalyze = (id: string) => {
    console.info(`Analyze anomaly ${id}`);
  };
  const handleIncreaseBid = (id: string, percent: number) => {
    void increaseBidRequest(id, percent).then(() => {
      setAnomalies((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'approved' as AnomalyStatus } : a))
      );
    });
  };
  const handleLowerBid = (id: string, percent: number) => {
    void lowerBidRequest(id, percent).then(() => {
      setAnomalies((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'approved' as AnomalyStatus } : a))
      );
    });
  };
  const handleExport = () => {
    if (severityDistribution.CRITICAL === 0) {
      console.info('No critical anomalies to summarize');
      return;
    }
    console.info(`Generating LLM summary for ${severityDistribution.CRITICAL} critical anomalies`);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <TopBar
          filename="all-reports"
          campaignCount={0}
          anomalyCount={0}
          onExport={handleExport}
        />
        <div className={styles.empty}>
          <p>Loading anomalies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <TopBar
          filename="error"
          campaignCount={0}
          anomalyCount={0}
          onExport={handleExport}
        />
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={fetchAnomalies}>Retry</button>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={styles.page}>
        <TopBar
          filename="no-anomalies"
          campaignCount={0}
          anomalyCount={0}
          onExport={handleExport}
        />
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>No anomalies found. Great job!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TopBar
        filename="all-reports"
        campaignCount={groups.length}
        anomalyCount={metrics.total}
        onExport={handleExport}
      />

      <SummaryMetrics
        total={metrics.total}
        critical={metrics.critical}
        pending={metrics.pending}
        resolved={metrics.resolved}
      />

      <div className={styles.body}>
        <div className={styles.left}>
          <CampaignTabs
            groups={groups}
            activeCampaignId={activeCampaignId}
            onSelect={handleTabChange}
          />
          <div className={styles.list}>
            {visibleGroups.map((group) => (
              <AnomalyGroup
                key={group.campaignId}
                group={group}
                selectedId={selectedAnomalyId}
                onSelect={setSelectedAnomalyId}
                onApproveAll={(ids: string[]) => handleStatusChangeBulk(ids, 'approved')}
                onRejectAll={(ids: string[]) => handleStatusChangeBulk(ids, 'rejected')}
              />
            ))}
          </div>
        </div>

        <div className={styles.right}>
          {selectedAnomaly ? (
            <AnomalyDetail
              anomaly={selectedAnomaly}
              onApprove={handleApprove}
              onReject={handleReject}
              onUndo={handleUndo}
              onAnalyze={handleAnalyze}
              onIncreaseBid={handleIncreaseBid}
              onLowerBid={handleLowerBid}
            />
          ) : (
            <AnomalyDetailEmpty />
          )}
        </div>
      </div>

      <div className={styles.bottom}>
        <Top5Ranking anomalies={top5} />
        <SeverityDonut
          critical={severityDistribution.CRITICAL}
          high={severityDistribution.HIGH}
          medium={severityDistribution.MEDIUM}
        />
      </div>
    </div>
  );
};

export default AnomaliesPage;