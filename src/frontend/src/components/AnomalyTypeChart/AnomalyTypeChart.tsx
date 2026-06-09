import type { ValidatedAnomaly } from '../../types';
import styles from './AnomalyTypeChart.module.css';

interface AnomalyTypeChartProps {
  anomalies: ValidatedAnomaly[];
}

interface AnomalyTypeCount {
  type: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const severityClassMap = {
  CRITICAL: styles.critical,
  HIGH: styles.high,
  MEDIUM: styles.medium,
  LOW: styles.low,
} as const;

export const AnomalyTypeChart = ({ anomalies }: AnomalyTypeChartProps) => {
  const typeCounts = anomalies.reduce<Record<string, AnomalyTypeCount>>((acc, anomaly) => {
    const type = anomaly.type;
    if (!acc[type]) {
      acc[type] = { type, count: 0, severity: anomaly.severity };
    }
    acc[type].count += 1;
    return acc;
  }, {});

  const sortedTypes = Object.values(typeCounts).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedTypes.map((t) => t.count), 1);

  return (
    <div className={styles.chart}>
      <h3 className={styles.title}>Anomaly Type Distribution</h3>
      <div className={styles.bars}>
        {sortedTypes.map((item) => (
          <div key={item.type} className={styles.row}>
            <span className={styles.label} title={item.type}>
              {item.type.replace(/_/g, ' ')}
            </span>
            <div className={styles.barContainer}>
              <div
                className={`${styles.bar} ${severityClassMap[item.severity]}`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
            <span className={styles.count}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};