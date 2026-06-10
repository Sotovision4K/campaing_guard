import type { AnomalyWithStatus } from '../../types/anomaly';
import styles from './Top5Ranking.module.css';

interface Top5RankingProps {
  anomalies: AnomalyWithStatus[];
}

export const Top5Ranking = ({ anomalies }: Top5RankingProps) => {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Top 5 critical anomalies</h3>
      <div className={styles.list}>
        {anomalies.length === 0 && (
          <p className={styles.empty}>No pending critical anomalies</p>
        )}
        {anomalies.map((a, idx) => {
          const isRed = idx < 2;
          const barColor = isRed ? styles.barRed : styles.barAmber;
          return (
            <div key={a.id} className={styles.row}>
              <span className={styles.rank}>{idx + 1}</span>
              <span className={styles.name} title={a.title}>
                {a.title}
              </span>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.bar} ${barColor}`}
                  style={{ width: `${a.score}%` }}
                />
              </div>
              <span className={styles.score}>{a.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};