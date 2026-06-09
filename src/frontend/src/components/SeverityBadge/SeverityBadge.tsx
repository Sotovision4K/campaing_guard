import styles from './SeverityBadge.module.css';

interface SeverityBadgeProps {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  count?: number;
  showIcon?: boolean;
}

const icons = {
  CRITICAL: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  HIGH: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  MEDIUM: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  LOW: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const severityClassMap = {
  CRITICAL: styles.critical,
  HIGH: styles.high,
  MEDIUM: styles.medium,
  LOW: styles.low,
} as const;

export const SeverityBadge = ({ severity, count, showIcon = true }: SeverityBadgeProps) => {
  return (
    <span className={`${styles.badge} ${severityClassMap[severity]}`}>
      {showIcon && <span className={styles.icon}>{icons[severity]}</span>}
      {count !== undefined ? (
        <span className={styles.count}>{count}</span>
      ) : (
        <span className={styles.label}>{severity}</span>
      )}
    </span>
  );
};