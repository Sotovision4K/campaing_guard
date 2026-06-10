import styles from './TopBar.module.css';

interface TopBarProps {
  filename: string;
  ingestedAt?: string;
  campaignCount: number;
  anomalyCount: number;
  onExport: () => void;
}

const formatDate = (date?: string): string => {
  if (!date) return 'Just now';
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TopBar = ({
  filename,
  ingestedAt,
  campaignCount,
  anomalyCount,
  onExport,
}: TopBarProps) => (
  <header className={styles.bar}>
    <div className={styles.left}>
      <h1 className={styles.title}>Anomaly detection</h1>
      <p className={styles.subtitle}>
        {filename} · Ingested {formatDate(ingestedAt)}
      </p>
    </div>
    <div className={styles.right}>
      <span className={styles.pill}>
        {campaignCount} campaigns · {anomalyCount} anomalies
      </span>
      <button type="button" className={styles.export} onClick={onExport}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export report
      </button>
    </div>
  </header>
);