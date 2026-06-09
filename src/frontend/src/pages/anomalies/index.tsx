import { useState, useEffect } from 'react';
import { useAnomalies } from '../../hooks/useAnomalies';
import type { Anomaly } from '../../services/anomalies.service';
import './index.css';

export const AnomaliesPage = () => {
  const {
    status,
    anomalies,
    selectedAnomaly,
    total,
    error,
    fetchAnomalies,
    selectAnomaly,
    reject,
    approve,
    clearSelection,
  } = useAnomalies();

  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    fetchAnomalies({
      severity: filterSeverity || undefined,
      status: filterStatus || undefined,
    });
  }, [filterSeverity, filterStatus, fetchAnomalies]);

  const handleSelectAnomaly = async (id: string) => {
    setActionReason('');
    await selectAnomaly(id);
  };

  const handleReject = async () => {
    if (!selectedAnomaly) return;
    await reject(selectedAnomaly.anomaly.anomaly_id, actionReason || 'User rejected as false positive.');
    setActionReason('');
  };

  const handleApprove = async () => {
    if (!selectedAnomaly) return;
    await approve(selectedAnomaly.anomaly.anomaly_id, actionReason || 'User approved anomaly.');
    setActionReason('');
  };

  const severityColor: Record<string, string> = {
    CRITICAL: 'severity-critical',
    HIGH: 'severity-high',
    MEDIUM: 'severity-medium',
    LOW: 'severity-low',
  };

  return (
    <div className="anomalies-page">
      <header className="anomalies-page__header">
        <h1>Anomalies</h1>
        <p>Review and act on detected campaign anomalies.</p>
      </header>

      <div className="anomalies-page__filters">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          aria-label="Filter by severity"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="investigating">Investigating</option>
          <option value="pending_insight">Pending Insight</option>
        </select>
        <span className="anomalies-page__count">Total: {total}</span>
      </div>

      {status === 'loading' && (
        <div className="anomalies-page__loading">Loading anomalies...</div>
      )}

      {status === 'error' && (
        <div className="anomalies-page__error" role="alert">
          {error}
          <button onClick={() => fetchAnomalies()}>Retry</button>
        </div>
      )}

      <div className="anomalies-page__layout">
        <div className="anomalies-page__list">
          {anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.anomaly_id}
              anomaly={anomaly}
              isSelected={selectedAnomaly?.anomaly.anomaly_id === anomaly.anomaly_id}
              severityClass={severityColor[anomaly.severity] || 'severity-low'}
              onClick={() => handleSelectAnomaly(anomaly.anomaly_id)}
            />
          ))}
          {anomalies.length === 0 && status !== 'loading' && (
            <div className="anomalies-page__empty">No anomalies found.</div>
          )}
        </div>

        {selectedAnomaly && (
          <div className="anomalies-page__detail">
            <div className="detail-header">
              <h2>{selectedAnomaly.anomaly.label || selectedAnomaly.anomaly.anomaly_type}</h2>
              <button className="detail-close" onClick={clearSelection} aria-label="Close details">
                ×
              </button>
            </div>

            <div className="detail-meta">
              <span className={`badge ${severityColor[selectedAnomaly.anomaly.severity] || ''}`}>
                {selectedAnomaly.anomaly.severity}
              </span>
              <span className={`badge status-${selectedAnomaly.anomaly.status}`}>
                {selectedAnomaly.anomaly.status}
              </span>
              <span className="detail-campaign">Campaign: {selectedAnomaly.anomaly.campaign_id}</span>
              <span className="detail-count">Count: {selectedAnomaly.anomaly.count}</span>
            </div>

            <div className="detail-dates">
              {selectedAnomaly.anomaly.date && (
                <span>Date: {selectedAnomaly.anomaly.date}</span>
              )}
              <span>Type: {selectedAnomaly.anomaly.anomaly_type}</span>
            </div>

            {selectedAnomaly.anomaly.feature_snapshot && (
              <div className="detail-snapshot">
                <h3>Details</h3>
                <pre>{JSON.stringify(selectedAnomaly.anomaly.feature_snapshot, null, 2)}</pre>
              </div>
            )}

            <div className="detail-actions">
              <h3>Action</h3>
              <textarea
                placeholder="Reason for action..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={2}
                className="action-reason"
              />

              <div className="action-buttons">
                <button
                  className="btn btn--reject"
                  onClick={handleReject}
                  disabled={status === 'action-loading'}
                >
                  Reject (False Positive)
                </button>
                <button
                  className="btn btn--approve"
                  onClick={handleApprove}
                  disabled={status === 'action-loading'}
                >
                  Approve
                </button>
              </div>
            </div>

            {selectedAnomaly.auditLogs.length > 0 && (
              <div className="detail-audit">
                <h3>Audit Log</h3>
                <ul className="audit-list">
                  {selectedAnomaly.auditLogs.map((log) => (
                    <li key={log.log_id} className="audit-item">
                      <span className="audit-action">{log.action}</span>
                      <span className="audit-actor">{log.actor}</span>
                      <span className="audit-date">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface AnomalyCardProps {
  anomaly: Anomaly;
  isSelected: boolean;
  severityClass: string;
  onClick: () => void;
}

const AnomalyCard = ({ anomaly, isSelected, severityClass, onClick }: AnomalyCardProps) => {
  return (
    <div
      className={`anomaly-card ${isSelected ? 'anomaly-card--selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="anomaly-card__header">
        <span className={`badge ${severityClass}`}>{anomaly.severity}</span>
        <span className={`badge status-${anomaly.status}`}>{anomaly.status}</span>
      </div>
      <div className="anomaly-card__title">
        {anomaly.label || anomaly.anomaly_type}
      </div>
      <div className="anomaly-card__meta">
        <span>{anomaly.campaign_id}</span>
        {anomaly.date && <span>• {anomaly.date}</span>}
        <span>• Count: {anomaly.count}</span>
      </div>
    </div>
  );
};

export default AnomaliesPage;
