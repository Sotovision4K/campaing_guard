import styles from './SummaryMetrics.module.css';

interface SummaryMetricsProps {
  total: number;
  critical: number;
  pending: number;
  resolved: number;
}

interface MetricCardProps {
  label: string;
  value: number;
  tone: 'default' | 'critical' | 'pending' | 'resolved';
}

const MetricCard = ({ label, value, tone }: MetricCardProps) => (
  <div className={`${styles.card} ${styles[tone]}`}>
    <span className={styles.value}>{value}</span>
    <span className={styles.label}>{label}</span>
  </div>
);

export const SummaryMetrics = ({ total, critical, pending, resolved }: SummaryMetricsProps) => (
  <div className={styles.row}>
    <MetricCard label="Total anomalies" value={total} tone="default" />
    <MetricCard label="Critical" value={critical} tone="critical" />
    <MetricCard label="Pending review" value={pending} tone="pending" />
    <MetricCard label="Resolved" value={resolved} tone="resolved" />
  </div>
);