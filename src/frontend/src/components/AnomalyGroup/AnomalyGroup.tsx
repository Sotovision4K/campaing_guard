import { useState } from 'react';
import type { CampaignGroup, AnomalySeverity } from '../../types/anomaly';
import { AnomalyRow } from '../AnomalyRow/AnomalyRow';
import styles from './AnomalyGroup.module.css';

interface AnomalyGroupProps {
  group: CampaignGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApproveAll: (ids: string[]) => void;
  onRejectAll: (ids: string[]) => void;
}

const severityPillClass: Record<AnomalySeverity, string> = {
  CRITICAL: styles.pillCritical,
  HIGH: styles.pillHigh,
  MEDIUM: styles.pillMedium,
  LOW: styles.pillLow,
};

export const AnomalyGroup = ({
  group,
  selectedId,
  onSelect,
  onApproveAll,
  onRejectAll,
}: AnomalyGroupProps) => {
  const [expanded, setExpanded] = useState(true);
  const pendingIds = group.anomalies.filter((a) => a.status === 'pending').map((a) => a.id);
  const showBulk = expanded && pendingIds.length > 1;

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <svg
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className={`${styles.pill} ${severityPillClass[group.topSeverity]}`}>
          {group.topSeverity}
        </span>
        <span className={styles.campaignName}>{group.campaignId}</span>
        <span className={styles.counts}>
          {group.anomalies.length} anomalies · {group.pendingCount} pending
        </span>
      </button>

      {expanded && (
        <>
          <div className={styles.rows}>
            {group.anomalies.map((a) => (
              <AnomalyRow
                key={a.id}
                anomaly={a}
                selected={selectedId === a.id}
                onSelect={onSelect}
              />
            ))}
          </div>
          {showBulk && (
            <div className={styles.bulkBar}>
              <button
                type="button"
                className={`${styles.bulkBtn} ${styles.bulkApprove}`}
                onClick={() => onApproveAll(pendingIds)}
              >
                ✓ Approve all
              </button>
              <button
                type="button"
                className={`${styles.bulkBtn} ${styles.bulkReject}`}
                onClick={() => onRejectAll(pendingIds)}
              >
                ✕ Reject all
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};