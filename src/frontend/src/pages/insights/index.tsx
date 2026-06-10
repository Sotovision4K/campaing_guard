import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listAnomalies, listAuditLogs } from '../../services/anomalies.service';
import type { AuditLog, Anomaly } from '../../services/anomalies.service';
import type { ApiResponse } from '../../api/client';
import type { UploadResponse, ReportSummary, ValidatedAnomaly } from '../../types';
import { ResultsDashboard } from '../dropzone/ResultsDashboard';
import { TopBar } from '../../components/TopBar/TopBar';
import styles from './Insights.module.css';

interface InsightsLocationState {
  reportId?: string;
}

const toValidatedAnomaly = (a: Anomaly): ValidatedAnomaly => {
  const snapshot = (a.feature_snapshot ?? {}) as Record<string, unknown>;
  return {
    id: a.anomaly_id,
    campaignId: a.campaign_id,
    date: a.date ?? '',
    type: a.anomaly_type,
    severity: a.severity,
    title: a.label ?? a.anomaly_type.replace(/_/g, ' '),
    insight:
      typeof snapshot.insight === 'string'
        ? snapshot.insight
        : typeof snapshot.description === 'string'
          ? snapshot.description
          : '',
    suggestedAction:
      typeof snapshot.action === 'string'
        ? snapshot.action
        : typeof snapshot.suggestedAction === 'string'
          ? snapshot.suggestedAction
          : '',
    confidence: Number(snapshot.confidence ?? 0.5),
    metadata: snapshot,
  };
};

const buildReportSummary = (anomalies: Anomaly[]): ReportSummary => {
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const a of anomalies) {
    if (a.severity in bySeverity) {
      bySeverity[a.severity as keyof typeof bySeverity] += 1;
    }
  }
  return {
    id: 'fetched-report',
    totalRows: anomalies.length,
    validRows: anomalies.length,
    regimesDetected: 0,
    anomaliesFound: anomalies.length,
    bySeverity,
    processingTime_ms: 0,
  };
};

const buildUploadResponse = (anomalies: Anomaly[]): UploadResponse => {
  const anomaliesByCampaign: Record<string, ValidatedAnomaly[]> = {};
  for (const a of anomalies) {
    const bucket = anomaliesByCampaign[a.campaign_id] ?? [];
    bucket.push(toValidatedAnomaly(a));
    anomaliesByCampaign[a.campaign_id] = bucket;
  }
  return {
    report: buildReportSummary(anomalies),
    anomaliesByCampaign,
  };
};

export const InsightsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as InsightsLocationState;
  const reportId = typeof state.reportId === 'string' ? state.reportId : null;

  if (!reportId) {
    return <AuditLogView />;
  }

  return <ReportView reportId={reportId} onReset={() => navigate('/')} />;
};

interface ReportViewProps {
  reportId: string;
  onReset: () => void;
}

const ReportView = ({ reportId, onReset }: ReportViewProps) => {
  const [data, setData] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response: ApiResponse<{ anomalies: Anomaly[]; total: number }> =
          await listAnomalies({ reportId, limit: 200 });
        if (cancelled) return;
        if (response.data.anomalies.length === 0) {
          setError('No anomalies found for this report.');
          setData(null);
        } else {
          setData(buildUploadResponse(response.data.anomalies));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <TopBar
          filename="report"
          campaignCount={0}
          anomalyCount={0}
          onExport={() => {}}
        />
        <div className={styles.empty} role="status">
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <TopBar
          filename="report"
          campaignCount={0}
          anomalyCount={0}
          onExport={() => {}}
        />
        <div className={styles.error} role="alert">
          <p>{error ?? 'Report not found.'}</p>
          <button type="button" onClick={onReset}>
            Back to upload
          </button>
        </div>
      </div>
    );
  }

  return <ResultsDashboard data={data} onReset={onReset} />;
};

const AuditLogView = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response: ApiResponse<{ logs: AuditLog[]; total: number }> = await listAuditLogs({ limit: 50 });
      setAuditLogs(response.data.logs);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  const actionStats = useMemo(() => {
    const actions: Record<string, number> = {};
    auditLogs.forEach((log) => {
      actions[log.action] = (actions[log.action] || 0) + 1;
    });
    return actions;
  }, [auditLogs]);

  const totalActions = auditLogs.length;
  const topActions = Object.entries(actionStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recentMetrics = useMemo(() => {
    const now = new Date();
    const last24h = auditLogs.filter((log) => {
      const logDate = new Date(log.created_at);
      return (now.getTime() - logDate.getTime()) < 24 * 60 * 60 * 1000;
    }).length;
    return { total: totalActions, last24h, uniqueActors: new Set(auditLogs.map((l) => l.actor)).size };
  }, [auditLogs, totalActions]);

  const handleExport = () => {
    console.info(`Exporting ${auditLogs.length} audit logs`);
  };

  return (
    <div className={styles.page}>
      <TopBar
        filename="audit-logs"
        campaignCount={0}
        anomalyCount={totalActions}
        onExport={handleExport}
      />

      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{recentMetrics.total}</span>
          <span className={styles.metricLabel}>Total Actions</span>
        </div>
        <div className={`${styles.metric} ${styles.metricHighlight}`}>
          <span className={styles.metricValue}>{recentMetrics.last24h}</span>
          <span className={styles.metricLabel}>Last 24h</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{recentMetrics.uniqueActors}</span>
          <span className={styles.metricLabel}>Unique Actors</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{Object.keys(actionStats).length}</span>
          <span className={styles.metricLabel}>Action Types</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Recent Activity</h3>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={fetchLogs}
                disabled={logsLoading}
              >
                {logsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {auditLogs.length === 0 && !logsLoading && (
              <div className={styles.empty}>No audit logs yet.</div>
            )}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Anomaly</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.log_id}>
                      <td>
                        <span className={`${styles.actionBadge} ${styles[`action_${log.action}`] || ''}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.actor}</td>
                      <td>
                        <code className={styles.anomalyId}>
                          {log.anomaly_id ? `${log.anomaly_id.slice(0, 8)}...` : '—'}
                        </code>
                      </td>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Top Actions</h3>
            {topActions.length === 0 ? (
              <div className={styles.empty}>No actions yet</div>
            ) : (
              <div className={styles.actionList}>
                {topActions.map(([action, count]) => {
                  const max = topActions[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  return (
                    <div key={action} className={styles.actionRow}>
                      <span className={styles.actionName}>{action}</span>
                      <div className={styles.actionBarTrack}>
                        <div
                          className={styles.actionBar}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={styles.actionCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
