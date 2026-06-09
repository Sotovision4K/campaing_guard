import type { UploadResponse } from '../../types';
import './UploadResult.css';

interface UploadResultProps {
  data: UploadResponse;
  onReset: () => void;
}

export const UploadResult = ({ data, onReset }: UploadResultProps) => {
  const { report, anomaliesByCampaign } = data;
  const campaignCount = Object.keys(anomaliesByCampaign).length;

  return (
    <div className="upload-result">
      <div className="upload-result__header">
        <h2 className="upload-result__title">Upload Complete</h2>
        <button className="upload-result__reset" onClick={onReset}>
          Upload Another
        </button>
      </div>

      <div className="upload-result__stats">
        <div className="upload-result__stat">
          <span className="upload-result__stat-value">{report.totalRows}</span>
          <span className="upload-result__stat-label">Total Rows</span>
        </div>
        <div className="upload-result__stat upload-result__stat--success">
          <span className="upload-result__stat-value">{report.validRows}</span>
          <span className="upload-result__stat-label">Valid</span>
        </div>
        <div className="upload-result__stat">
          <span className="upload-result__stat-value">{report.regimesDetected}</span>
          <span className="upload-result__stat-label">Regimes</span>
        </div>
        <div className="upload-result__stat upload-result__stat--error">
          <span className="upload-result__stat-value">{report.anomaliesFound}</span>
          <span className="upload-result__stat-label">Anomalies</span>
        </div>
      </div>

      <div className="upload-result__severity">
        <h3>Severity Breakdown</h3>
        <div className="severity-grid">
          <div className="severity-item severity-critical">
            <span className="severity-value">{report.bySeverity.CRITICAL}</span>
            <span className="severity-label">Critical</span>
          </div>
          <div className="severity-item severity-high">
            <span className="severity-value">{report.bySeverity.HIGH}</span>
            <span className="severity-label">High</span>
          </div>
          <div className="severity-item severity-medium">
            <span className="severity-value">{report.bySeverity.MEDIUM}</span>
            <span className="severity-label">Medium</span>
          </div>
          <div className="severity-item severity-low">
            <span className="severity-value">{report.bySeverity.LOW}</span>
            <span className="severity-label">Low</span>
          </div>
        </div>
      </div>

      <div className="upload-result__campaigns">
        <h3>Campaigns with Anomalies ({campaignCount})</h3>
        {campaignCount === 0 ? (
          <p className="upload-result__no-anomalies">No anomalies detected. Great job!</p>
        ) : (
          <div className="campaign-list">
            {Object.entries(anomaliesByCampaign).map(([campaignId, anomalies]) => (
              <div key={campaignId} className="campaign-item">
                <div className="campaign-name">{campaignId}</div>
                <div className="campaign-count">{anomalies.length} anomaly{anomalies.length !== 1 ? 'ies' : 'y'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
