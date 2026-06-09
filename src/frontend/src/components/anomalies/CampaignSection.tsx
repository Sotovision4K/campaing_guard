import { useState } from 'react';
import type { CampaignGroup } from '../../hooks/useCampaignAnomalies';
import { AnomalyCard, type AnomalyAction } from './AnomalyCard';
import './CampaignSection.css';

interface CampaignSectionProps {
  group: CampaignGroup;
  defaultExpanded?: boolean;
  onAction: (anomalyId: string, action: AnomalyAction) => Promise<void>;
}

export const CampaignSection = ({ group, defaultExpanded = false, onAction }: CampaignSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedAnomalyId, setExpandedAnomalyId] = useState<string | null>(null);

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleAnomalyToggle = (anomalyId: string) => {
    setExpandedAnomalyId(expandedAnomalyId === anomalyId ? null : anomalyId);
  };

  return (
    <div className={`campaign-section ${isExpanded ? 'campaign-section--expanded' : ''}`}>
      <button className="campaign-section__header" onClick={handleToggle} aria-expanded={isExpanded}>
        <div className="campaign-section__title-row">
          <span className="campaign-section__name">{group.campaignId}</span>
          <span className="campaign-section__count">{group.totalAnomalies} anomaly{group.totalAnomalies !== 1 ? 'ies' : 'y'}</span>
        </div>

        <div className="campaign-section__severity-row">
          {group.severityCounts.CRITICAL > 0 && (
            <span className="severity-pill severity-critical">{group.severityCounts.CRITICAL} CRITICAL</span>
          )}
          {group.severityCounts.HIGH > 0 && (
            <span className="severity-pill severity-high">{group.severityCounts.HIGH} HIGH</span>
          )}
          {group.severityCounts.MEDIUM > 0 && (
            <span className="severity-pill severity-medium">{group.severityCounts.MEDIUM} MEDIUM</span>
          )}
          {group.severityCounts.LOW > 0 && (
            <span className="severity-pill severity-low">{group.severityCounts.LOW} LOW</span>
          )}
        </div>

        <span className={`campaign-section__chevron ${isExpanded ? 'campaign-section__chevron--up' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="campaign-section__anomalies">
          {group.anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              isExpanded={expandedAnomalyId === anomaly.id}
              onToggle={() => handleAnomalyToggle(anomaly.id)}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};