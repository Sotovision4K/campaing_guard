import { useState, useMemo } from 'react';
import type { UploadResponse, ValidatedAnomaly } from '../../types';
import styles from './ResultsDashboard.module.css';

interface ResultsDashboardProps {
  data: UploadResponse;
  onReset: () => void;
}

export const ResultsDashboard = ({ data, onReset }: ResultsDashboardProps) => {
  const { report, anomaliesByCampaign } = data;
  const allAnomalies = useMemo(
    () => Object.values(anomaliesByCampaign).flat(),
    [anomaliesByCampaign]
  );

  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(
    allAnomalies[0]?.id || null
  );
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set(Object.keys(anomaliesByCampaign))
  );
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const selectedAnomaly = useMemo(
    () => allAnomalies.find((a) => a.id === selectedAnomalyId) || null,
    [allAnomalies, selectedAnomalyId]
  );

  // Top 5 anomalies by severity then count
  const topAnomalies = useMemo(() => {
    const severityWeight = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return [...allAnomalies]
      .sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity])
      .slice(0, 5);
  }, [allAnomalies]);

  const summaryStats = [
    { label: 'Total Rows', value: report.totalRows.toLocaleString(), tone: 'neutral' as const },
    { label: 'Valid', value: report.validRows.toLocaleString(), tone: 'success' as const },
    { label: 'Regimes', value: report.regimesDetected, tone: 'info' as const },
    { label: 'Anomalies', value: report.anomaliesFound, tone: 'error' as const },
  ];

  // Group by type with counts
  const anomaliesByType = useMemo(() => {
    const map: Record<string, ValidatedAnomaly[]> = {};
    allAnomalies.forEach((a) => {
      if (!map[a.type]) map[a.type] = [];
      map[a.type].push(a);
    });
    return Object.entries(map)
      .map(([type, items]) => ({ type, count: items.length, items }))
      .sort((a, b) => b.count - a.count);
  }, [allAnomalies]);

  const maxTypeCount = Math.max(...anomaliesByType.map((t) => t.count), 1);

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (allAnomalies.length === 0) {
    return (
      <div className={styles.result}>
        <div className={styles.header}>
          <h2 className={styles.title}>Analysis Complete</h2>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onReset}>
            Upload Another
          </button>
        </div>
        <div className={styles.statsRow}>
          {summaryStats.map((s) => (
            <div key={s.label} className={`${styles.stat} ${styles[`stat_${s.tone}`]}`}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
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
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Analysis Complete</h2>
          <p className={styles.subtitle}>
            {report.anomaliesFound} anomalies across {Object.keys(anomaliesByCampaign).length} campaigns
          </p>
        </div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onReset}>
          Upload Another
        </button>
      </div>

      {/* Compact stats */}
      <div className={styles.statsRow}>
        {summaryStats.map((s) => (
          <div key={s.label} className={`${styles.stat} ${styles[`stat_${s.tone}`]}`}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
          <div
            key={sev}
            className={`${styles.stat} ${styles.stat_severity} ${styles[`sev_${sev.toLowerCase()}`]}`}
          >
            <span className={styles.statValue}>{report.bySeverity[sev]}</span>
            <span className={styles.statLabel}>{sev}</span>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        {/* Left: list of campaigns/anomalies */}
        <div className={styles.left}>
          {/* Anomaly distribution chart */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Anomaly Distribution</h3>
            <div className={styles.distList}>
              {anomaliesByType.map(({ type, count, items }) => {
                const severity = items[0].severity;
                const pct = (count / maxTypeCount) * 100;
                return (
                  <div key={type} className={styles.distRow}>
                    <span className={styles.distLabel} title={type}>
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className={styles.distBarTrack}>
                      <div
                        className={`${styles.distBar} ${styles[`bar_${severity.toLowerCase()}`]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={styles.distCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 anomalies */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Top 5 by Severity</h3>
            <div className={styles.topList}>
              {topAnomalies.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.topItem} ${
                    selectedAnomalyId === a.id ? styles.topItemActive : ''
                  } ${styles[`border_${a.severity.toLowerCase()}`]}`}
                  onClick={() => setSelectedAnomalyId(a.id)}
                >
                  <span className={`${styles.sevDot} ${styles[`dot_${a.severity.toLowerCase()}`]}`} />
                  <span className={styles.topType}>{a.type.replace(/_/g, ' ')}</span>
                  <span className={styles.topCampaign}>{a.campaignId}</span>
                  <span className={styles.topDate}>{a.date}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Campaigns accordion */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              Campaigns
              <span className={styles.panelCount}>{Object.keys(anomaliesByCampaign).length}</span>
            </h3>
            <div className={styles.campaignList}>
              {Object.entries(anomaliesByCampaign).map(([campaignId, anomalies]) => {
                const isOpen = expandedCampaigns.has(campaignId);

                // Group by type within campaign
                const byType: Record<string, ValidatedAnomaly[]> = {};
                anomalies.forEach((a) => {
                  if (!byType[a.type]) byType[a.type] = [];
                  byType[a.type].push(a);
                });
                const typeEntries = Object.entries(byType).sort(
                  ([, a], [, b]) => b.length - a.length
                );

                return (
                  <div key={campaignId} className={styles.campaign}>
                    <button
                      type="button"
                      className={styles.campaignHeader}
                      onClick={() => toggleCampaign(campaignId)}
                    >
                      <svg
                        className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className={styles.campaignName}>{campaignId}</span>
                      <span className={styles.campaignBadge}>{anomalies.length}</span>
                    </button>
                    {isOpen && (
                      <div className={styles.campaignBody}>
                        {typeEntries.map(([type, items]) => {
                          const typeKey = `${campaignId}-${type}`;
                          const typeOpen = expandedTypes.has(typeKey);
                          return (
                            <div key={type} className={styles.typeGroup}>
                              <button
                                type="button"
                                className={styles.typeHeader}
                                onClick={() => toggleType(typeKey)}
                              >
                                <svg
                                  className={`${styles.chevronSm} ${typeOpen ? styles.chevronOpen : ''}`}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                                <span className={styles.typeName}>
                                  {type.replace(/_/g, ' ')}
                                </span>
                                <span className={styles.typeCount}>{items.length}</span>
                              </button>
                              {typeOpen && (
                                <div className={styles.anomalyGrid}>
                                  {items.map((a) => (
                                    <button
                                      key={a.id}
                                      type="button"
                                      className={`${styles.anomalyCard} ${
                                        selectedAnomalyId === a.id ? styles.anomalyCardActive : ''
                                      } ${styles[`border_${a.severity.toLowerCase()}`]}`}
                                      onClick={() => setSelectedAnomalyId(a.id)}
                                    >
                                      <div className={styles.anomalyCardHeader}>
                                        <span
                                          className={`${styles.sevDot} ${styles[`dot_${a.severity.toLowerCase()}`]}`}
                                        />
                                        <span className={styles.anomalyDate}>{a.date}</span>
                                      </div>
                                      <div className={styles.anomalyActions}>
                                        <span
                                          className={styles.miniAction}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                          }}
                                          role="button"
                                        >
                                          ↑ Bid
                                        </span>
                                        <span
                                          className={`${styles.miniAction} ${styles.miniActionDanger}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                          }}
                                          role="button"
                                        >
                                          ✕ Reject
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: details panel */}
        <div className={styles.right}>
          {selectedAnomaly ? (
            <AnomalyDetail
              anomaly={selectedAnomaly}
              onIncreaseBid={() => {}}
              onReject={() => {}}
            />
          ) : (
            <div className={styles.detailEmpty}>
              <p>Select an anomaly to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AnomalyDetailProps {
  anomaly: ValidatedAnomaly;
  onIncreaseBid: () => void;
  onReject: () => void;
}

const AnomalyDetail = ({ anomaly, onIncreaseBid, onReject }: AnomalyDetailProps) => {
  const meta = anomaly.metadata || {};
  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <span
          className={`${styles.detailSev} ${styles[`sev_${anomaly.severity.toLowerCase()}`]}`}
        >
          {anomaly.severity}
        </span>
        <h3 className={styles.detailTitle}>{anomaly.title || anomaly.type.replace(/_/g, ' ')}</h3>
      </div>
      <div className={styles.detailMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Campaign</span>
          <span className={styles.metaValue}>{anomaly.campaignId}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Date</span>
          <span className={styles.metaValue}>{anomaly.date}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Type</span>
          <span className={styles.metaValue}>{anomaly.type.replace(/_/g, ' ')}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Confidence</span>
          <span className={styles.metaValue}>
            {anomaly.confidence ? `${Math.round(anomaly.confidence * 100)}%` : 'N/A'}
          </span>
        </div>
      </div>

      <div className={styles.detailSection}>
        <h4 className={styles.sectionTitle}>Insight</h4>
        <p className={styles.insight}>{anomaly.insight || 'No insight available'}</p>
      </div>

      {Object.keys(meta).length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.sectionTitle}>Values</h4>
          <div className={styles.valuesGrid}>
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className={styles.valueRow}>
                <span className={styles.valueKey}>{k.replace(/_/g, ' ')}</span>
                <span className={styles.valueVal}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.detailSection}>
        <h4 className={styles.sectionTitle}>Suggested Action</h4>
        <p className={styles.suggestion}>
          {anomaly.suggestedAction || 'Review and decide on action'}
        </p>
      </div>

      <div className={styles.detailActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onIncreaseBid}
        >
          ↑ Increase Bid
        </button>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onIncreaseBid}
        >
          ↓ Lower Bid
        </button>
        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={onReject}
        >
          ✕ Reject
        </button>
        <button className={`${styles.btn} ${styles.btnSecondary}`}>
          ✓ Approve
        </button>
      </div>
    </div>
  );
};