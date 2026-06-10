import { useState, useMemo } from 'react';
import type { UploadResponse } from '../../types';
import { useAnomalyDashboard } from '../../hooks/useAnomalyDashboard';
import {
  approveAnomaly,
  rejectAnomaly,
  bulkActionAnomalies,
  increaseBid as increaseBidRequest,
  lowerBid as lowerBidRequest,
} from '../../services/anomalies.service';
import { TopBar } from '../../components/TopBar/TopBar';
import { SummaryMetrics } from '../../components/SummaryMetrics/SummaryMetrics';
import { CampaignTabs } from '../../components/CampaignTabs/CampaignTabs';
import { AnomalyGroup } from '../../components/AnomalyGroup/AnomalyGroup';
import { AnomalyDetail, AnomalyDetailEmpty } from '../../components/AnomalyDetail/AnomalyDetail';
import { Top5Ranking } from '../../components/Top5Ranking/Top5Ranking';
import { SeverityDonut } from '../../components/SeverityDonut/SeverityDonut';
import styles from './ResultsDashboard.module.css';

interface ResultsDashboardProps {
  data: UploadResponse;
  onReset: () => void;
}

export const ResultsDashboard = ({ data, onReset }: ResultsDashboardProps) => {
  const {
    groups,
    metrics,
    top5,
    severityDistribution,
    setStatus,
    setStatusBulk,
    report,
  } = useAnomalyDashboard(data);

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

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

  const handleSelectAnomaly = (id: string) => setSelectedAnomalyId(id);

  const handleTabChange = (id: string | null) => {
    setActiveCampaignId(id);
    setSelectedAnomalyId(null);
  };

  const handleApprove = (id: string) => {
    setStatus(id, 'approved');
    void approveAnomaly(id);
  };
  const handleReject = (id: string) => {
    setStatus(id, 'rejected');
    void rejectAnomaly(id);
  };
  const handleUndo = (id: string) => setStatus(id, 'pending');
  const handleApproveAll = (ids: string[]) => {
    setStatusBulk(ids, 'approved');
    void bulkActionAnomalies(ids, 'approved');
  };
  const handleRejectAll = (ids: string[]) => {
    setStatusBulk(ids, 'rejected');
    void bulkActionAnomalies(ids, 'rejected');
  };
  const handleIncreaseBid = (id: string, percent: number) => {
    setStatus(id, 'approved');
    void increaseBidRequest(id, percent);
  };
  const handleLowerBid = (id: string, percent: number) => {
    setStatus(id, 'approved');
    void lowerBidRequest(id, percent);
  };
  const handleAnalyze = (id: string) => {
    // Placeholder: would call LLM endpoint in a real implementation
    console.info(`Analyze anomaly ${id}`);
  };
  const handleExport = () => {
    const critical = severityDistribution.CRITICAL;
    if (critical === 0) {
      console.info('No critical anomalies to summarize');
      return;
    }
    console.info(`Generating LLM summary for ${critical} critical anomalies`);
  };

  if (groups.length === 0) {
    return (
      <div className={styles.result}>
        <div className={styles.header}>
          <h2 className={styles.title}>Analysis Complete</h2>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onReset}>
            Upload Another
          </button>
        </div>
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className={styles.emptyText}>No anomalies detected. Great job!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <TopBar
        filename={data.report?.id || 'campaign.csv'}
        ingestedAt={report?.id}
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
                onSelect={handleSelectAnomaly}
                onApproveAll={handleApproveAll}
                onRejectAll={handleRejectAll}
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