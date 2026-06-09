import { useState } from 'react';
import type { ValidatedAnomaly } from '../../types';
import { SeverityBadge } from '../SeverityBadge';
import styles from './CampaignList.module.css';

interface CampaignListProps {
  anomaliesByCampaign: Record<string, ValidatedAnomaly[]>;
}

const severityBorderClassMap = {
  CRITICAL: styles.anomalyCritical,
  HIGH: styles.anomalyHigh,
  MEDIUM: styles.anomalyMedium,
  LOW: styles.anomalyLow,
} as const;

export const CampaignList = ({ anomaliesByCampaign }: CampaignListProps) => {
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const campaigns = Object.entries(anomaliesByCampaign);
  const totalCampaigns = campaigns.length;

  if (totalCampaigns === 0) {
    return (
      <div className={styles.empty}>
        <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className={styles.emptyText}>No anomalies detected. Great job!</span>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Campaigns with Anomalies</h3>
        <span className={styles.sectionCount}>{totalCampaigns}</span>
      </div>
      <div className={styles.list}>
        {campaigns.map(([campaignId, anomalies]) => {
          const isExpanded = expandedCampaign === campaignId;
          const itemClassName = [styles.item, isExpanded && styles.itemExpanded]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={campaignId} className={itemClassName}>
              <div
                className={styles.itemHeader}
                onClick={() => setExpandedCampaign(isExpanded ? null : campaignId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedCampaign(isExpanded ? null : campaignId)}
              >
                <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className={styles.name}>{campaignId}</span>
                <span className={styles.badge}>{anomalies.length}</span>
              </div>
              {isExpanded && (
                <div className={styles.anomalies}>
                  {anomalies.map((anomaly, index) => (
                    <div
                      key={`${anomaly.id}-${index}`}
                      className={`${styles.anomaly} ${severityBorderClassMap[anomaly.severity]}`}
                    >
                      <SeverityBadge severity={anomaly.severity} showIcon={false} />
                      <span className={styles.anomalyType}>
                        {anomaly.type.replace(/_/g, ' ')}
                      </span>
                      {anomaly.date && (
                        <span className={styles.anomalyDate}>{anomaly.date}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};