import { useState, useMemo, useCallback } from 'react';
import type { UploadResponse } from '../../types';
import { useCampaignAnomalies } from '../../hooks/useCampaignAnomalies';
import { CampaignSection } from './CampaignSection';
import { type AnomalyAction } from './AnomalyCard';
import { approveAnomaly, rejectAnomaly, increaseBid, lowerBid } from '../../services/anomalies.service';
import './CampaignAnomalyList.css';

interface CampaignAnomalyListProps {
  uploadData: UploadResponse;
}

export const CampaignAnomalyList = ({ uploadData }: CampaignAnomalyListProps) => {
  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const { groups, criticalCount } = useCampaignAnomalies(uploadData.anomaliesByCampaign);

  const handleAction = useCallback(async (anomalyId: string, action: AnomalyAction) => {
    switch (action) {
      case 'approve':
        await approveAnomaly(anomalyId);
        break;
      case 'reject':
        await rejectAnomaly(anomalyId);
        break;
      case 'increase-bid':
        await increaseBid(anomalyId);
        break;
      case 'lower-bid':
        await lowerBid(anomalyId);
        break;
    }
  }, []);

  const filteredGroups = useMemo(() => {
    if (!filterCampaign) return groups;
    return groups.filter(g => g.campaignId === filterCampaign);
  }, [groups, filterCampaign]);

  const filteredTotalAnomalies = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.totalAnomalies, 0),
    [filteredGroups]
  );

  if (groups.length === 0) {
    return (
      <div className="campaign-anomaly-list campaign-anomaly-list--empty">
        <p className="campaign-anomaly-list__empty-message">No anomalies detected. Great job!</p>
      </div>
    );
  }

  return (
    <div className="campaign-anomaly-list">
      <div className="campaign-anomaly-list__summary">
        <div className="campaign-anomaly-list__summary-item campaign-anomaly-list__summary-item--critical">
          <span className="campaign-anomaly-list__summary-value">{criticalCount}</span>
          <span className="campaign-anomaly-list__summary-label">Critical</span>
        </div>
        <div className="campaign-anomaly-list__summary-item">
          <span className="campaign-anomaly-list__summary-value">{filteredTotalAnomalies}</span>
          <span className="campaign-anomaly-list__summary-label">Total Anomalies</span>
        </div>
        <div className="campaign-anomaly-list__summary-item">
          <span className="campaign-anomaly-list__summary-value">{filteredGroups.length}</span>
          <span className="campaign-anomaly-list__summary-label">Campaigns</span>
        </div>
      </div>

      <div className="campaign-anomaly-list__filters">
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="campaign-anomaly-list__filter-select"
          aria-label="Filter by campaign"
        >
          <option value="">All Campaigns</option>
          {groups.map(group => (
            <option key={group.campaignId} value={group.campaignId}>
              {group.campaignId} ({group.totalAnomalies})
            </option>
          ))}
        </select>
        {filterCampaign && (
          <button
            className="campaign-anomaly-list__filter-clear"
            onClick={() => setFilterCampaign('')}
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="campaign-anomaly-list__report">
        <p className="campaign-anomaly-list__report-time">
          Processed in {uploadData.report.processingTime_ms}ms
        </p>
      </div>

      <div className="campaign-anomaly-list__groups">
        {filteredGroups.map((group, index) => (
          <CampaignSection
            key={group.campaignId}
            group={group}
            defaultExpanded={index === 0 && group.criticalCount > 0}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  );
};