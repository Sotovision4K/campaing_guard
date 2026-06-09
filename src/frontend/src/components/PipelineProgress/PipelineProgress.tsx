import { useState, useEffect, useRef } from 'react';
import styles from './PipelineProgress.module.css';

interface PipelineProgressProps {
  currentStage: number;
}

const STAGES = [
  'Data Quality',
  'Normalisation',
  'Regime Detection',
  'Anomaly Detection',
  'LLM Validation',
];

export const PipelineProgress = ({ currentStage }: PipelineProgressProps) => {
  const [stageTimes, setStageTimes] = useState<Record<number, number>>({});
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setStageTimes((prev) => {
        const updated = { ...prev };
        for (let i = 1; i <= 5; i++) {
          if (i === currentStage && !updated[i]) {
            updated[i] = now - startTimeRef.current;
          }
        }
        return updated;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStage]);

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms / 100) / 10}s`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={styles.stages}>
      {STAGES.map((name, index) => {
        const stageNum = index + 1;
        const isCompleted = stageNum < currentStage;
        const isActive = stageNum === currentStage;
        const isPending = stageNum > currentStage;

        const stageClassName = [
          styles.stage,
          isCompleted && styles.stageCompleted,
          isActive && styles.stageActive,
          isPending && styles.stagePending,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={name} className={stageClassName}>
            <div className={styles.stageIndicator}>
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isActive ? (
                <span className={styles.pulse}>{stageNum}</span>
              ) : (
                stageNum
              )}
            </div>
            <div className={styles.stageInfo}>
              <span className={styles.stageName}>{name}</span>
              {isActive && (
                <span className={styles.stageTime}>In progress...</span>
              )}
              {isCompleted && stageTimes[stageNum] && (
                <span className={styles.stageTime}>
                  Completed in {formatTime(stageTimes[stageNum])}
                </span>
              )}
            </div>
            {isCompleted && stageTimes[stageNum] && (
              <span className={styles.stageStatus}>✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
};