import type { AnomalyWithStatus, AnomalySeverity } from '../../types/anomaly';
import styles from './AnomalyRow.module.css';

interface AnomalyRowProps {
  anomaly: AnomalyWithStatus;
  selected: boolean;
  onSelect: (id: string) => void;
}

const severityDotClass: Record<AnomalySeverity, string> = {
  CRITICAL: styles.dotCritical,
  HIGH: styles.dotHigh,
  MEDIUM: styles.dotMedium,
  LOW: styles.dotLow,
};

const severityBadgeClass: Record<AnomalySeverity, string> = {
  CRITICAL: styles.badgeCritical,
  HIGH: styles.badgeHigh,
  MEDIUM: styles.badgeMedium,
  LOW: styles.badgeLow,
};

export const AnomalyRow = ({ anomaly, selected, onSelect }: AnomalyRowProps) => {
  const isActioned = anomaly.status !== 'pending';

  return (
    <button
      type="button"
      role="row"
      aria-selected={selected}
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect(anomaly.id)}
    >
      <span
        className={`${styles.dot} ${severityDotClass[anomaly.severity]}`}
        aria-label={anomaly.severity}
      />
      <span className={styles.name}>{anomaly.title}</span>
      <span className={styles.signal}>{anomaly.signal}</span>
      <span className={styles.statusSlot}>
        {isActioned ? (
          <span
            className={`${styles.chip} ${
              anomaly.status === 'approved' ? styles.chipApproved : styles.chipRejected
            }`}
          >
            {anomaly.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
          </span>
        ) : (
          <span className={`${styles.badge} ${severityBadgeClass[anomaly.severity]}`}>
            {anomaly.severity}
          </span>
        )}
      </span>
    </button>
  );
};