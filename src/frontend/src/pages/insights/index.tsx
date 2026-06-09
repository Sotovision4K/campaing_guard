import { useState, useEffect } from 'react';
import { listAuditLogs } from '../../services/anomalies.service';
import type { AuditLog } from '../../services/anomalies.service';
import type { ApiResponse } from '../../api/client';
import './index.css';

export const InsightsPage = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const response: ApiResponse<{ logs: AuditLog[]; total: number }> = await listAuditLogs({ limit: 50 });
      setAuditLogs(response.data.logs);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="insights-page">
      <header className="insights-page__header">
        <h1>Audit Logs</h1>
        <p>View history of all anomaly actions and system events.</p>
      </header>

      <section className="insights-page__logs">
        <h2>Recent Activity</h2>
        <button className="btn btn--refresh" onClick={fetchLogs} disabled={logsLoading}>
          {logsLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        {auditLogs.length === 0 && !logsLoading && (
          <div className="empty">No audit logs yet.</div>
        )}
        <div className="logs-table-wrapper">
          <table className="logs-table">
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
                    <span className={`log-badge action-${log.action}`}>{log.action}</span>
                  </td>
                  <td>{log.actor}</td>
                  <td>{log.anomaly_id ? log.anomaly_id.slice(0, 8) + '...' : '—'}</td>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default InsightsPage;