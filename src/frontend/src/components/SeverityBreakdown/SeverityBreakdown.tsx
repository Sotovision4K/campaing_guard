import type { SeverityCount } from '../../types';
import styles from './SeverityBreakdown.module.css';

interface SeverityBreakdownProps {
  counts: SeverityCount;
  total: number;
}

export const SeverityBreakdown = ({ counts, total }: SeverityBreakdownProps) => {
  const getPercentage = (count: number) => (total > 0 ? (count / total) * 100 : 0);

  return (
    <div className={styles.breakdown}>
      <h3 className={styles.title}>Severity Breakdown</h3>
      <div className={styles.bar}>
        <div
          className={`${styles.segment} ${styles.critical}`}
          style={{ width: `${getPercentage(counts.CRITICAL)}%` }}
        >
          {counts.CRITICAL > 0 && counts.CRITICAL}
        </div>
        <div
          className={`${styles.segment} ${styles.high}`}
          style={{ width: `${getPercentage(counts.HIGH)}%` }}
        >
          {counts.HIGH > 0 && counts.HIGH}
        </div>
        <div
          className={`${styles.segment} ${styles.medium}`}
          style={{ width: `${getPercentage(counts.MEDIUM)}%` }}
        >
          {counts.MEDIUM > 0 && counts.MEDIUM}
        </div>
        <div
          className={`${styles.segment} ${styles.low}`}
          style={{ width: `${getPercentage(counts.LOW)}%` }}
        >
          {counts.LOW > 0 && counts.LOW}
        </div>
      </div>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.critical}`} />
          <span className={styles.legendLabel}>Critical</span>
          <span className={styles.legendCount}>{counts.CRITICAL}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.high}`} />
          <span className={styles.legendLabel}>High</span>
          <span className={styles.legendCount}>{counts.HIGH}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.medium}`} />
          <span className={styles.legendLabel}>Medium</span>
          <span className={styles.legendCount}>{counts.MEDIUM}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.low}`} />
          <span className={styles.legendLabel}>Low</span>
          <span className={styles.legendCount}>{counts.LOW}</span>
        </div>
      </div>
    </div>
  );
};