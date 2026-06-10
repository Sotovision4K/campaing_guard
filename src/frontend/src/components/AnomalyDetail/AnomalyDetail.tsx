import { useState } from 'react';
import type { AnomalyWithStatus, AnomalySeverity } from '../../types/anomaly';
import styles from './AnomalyDetail.module.css';

interface AnomalyDetailProps {
  anomaly: AnomalyWithStatus;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUndo: (id: string) => void;
  onAnalyze: (id: string) => void;
  onIncreaseBid?: (id: string, percent: number) => void;
  onLowerBid?: (id: string, percent: number) => void;
}

const severityBadgeClass: Record<AnomalySeverity, string> = {
  CRITICAL: styles.sevBadgeCritical,
  HIGH: styles.sevBadgeHigh,
  MEDIUM: styles.sevBadgeMedium,
  LOW: styles.sevBadgeLow,
};

const formatMetric = (value: number, suffix: string = ''): string => {
  if (!Number.isFinite(value) || value === 0) return '—';
  return `${value.toFixed(2)}${suffix}`;
};

const formatSpend = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return '—';
  return `$${value.toFixed(2)}`;
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

export const AnomalyDetail = ({
  anomaly,
  onApprove,
  onReject,
  onUndo,
  onAnalyze,
  onIncreaseBid,
  onLowerBid,
}: AnomalyDetailProps) => {
  const isCritical = anomaly.severity === 'CRITICAL';
  const isHigh = anomaly.severity === 'HIGH';
  const acosClass = isCritical ? styles.kpiCritical : isHigh ? styles.kpiHigh : '';
  const scoreClass = anomaly.score >= 90 ? styles.kpiCritical : anomaly.score >= 65 ? styles.kpiHigh : '';
  const isActioned = anomaly.status !== 'pending';

  const [bidPercent, setBidPercent] = useState<number>(10);
  const [bidOpen, setBidOpen] = useState(false);

  const handleBid = (direction: 'up' | 'down') => {
    const safe = Number.isFinite(bidPercent) && bidPercent > 0 ? bidPercent : 10;
    if (direction === 'up' && onIncreaseBid) onIncreaseBid(anomaly.id, safe);
    if (direction === 'down' && onLowerBid) onLowerBid(anomaly.id, safe);
  };

  const showBidControls = Boolean(onIncreaseBid && onLowerBid) && !isActioned;

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>{anomaly.title}</h3>
          <span className={`${styles.sevBadge} ${severityBadgeClass[anomaly.severity]}`}>
            {anomaly.severity}
          </span>
        </div>
        <span className={styles.campaignTag}>{anomaly.campaignId}</span>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>ACoS</span>
          <span className={`${styles.kpiValue} ${acosClass}`}>
            {formatPercent(anomaly.metrics.acos)}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>ROAS</span>
          <span className={styles.kpiValue}>{formatMetric(anomaly.metrics.roas)}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Spend</span>
          <span className={styles.kpiValue}>{formatSpend(anomaly.metrics.spend)}</span>
        </div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Metric signal</span>
          <span className={styles.kpiValueSm}>{anomaly.signal}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Anomaly score</span>
          <span className={`${styles.kpiValue} ${scoreClass}`}>{anomaly.score}</span>
        </div>
      </div>

      <p className={styles.description}>
        {anomaly.description || anomaly.insight || 'No description available.'}
      </p>

      {isActioned ? (
        <div className={styles.actionBar}>
          <span
            className={`${styles.chip} ${
              anomaly.status === 'approved' ? styles.chipApproved : styles.chipRejected
            }`}
          >
            {anomaly.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
          </span>
          <button
            type="button"
            className={styles.undo}
            onClick={() => onUndo(anomaly.id)}
          >
            Undo
          </button>
        </div>
      ) : (
        <>
          <div className={styles.actionBar}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.approve}`}
              onClick={() => onApprove(anomaly.id)}
            >
              ✓ Approve
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.reject}`}
              onClick={() => onReject(anomaly.id)}
            >
              ✕ Reject
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.analyze}`}
              onClick={() => onAnalyze(anomaly.id)}
            >
              Analyze ↗
            </button>
            {showBidControls && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.bidToggle}`}
                onClick={() => setBidOpen((v) => !v)}
                aria-expanded={bidOpen}
              >
                {bidOpen ? 'Hide bids' : 'Adjust bid ↕'}
              </button>
            )}
          </div>
          {showBidControls && bidOpen && (
            <div className={styles.bidBar}>
              <label className={styles.bidLabel}>
                <span>Percent</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={bidPercent}
                  onChange={(e) => setBidPercent(Number(e.target.value))}
                  className={styles.bidInput}
                />
              </label>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.bidUp}`}
                onClick={() => handleBid('up')}
              >
                ↑ Increase bid
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.bidDown}`}
                onClick={() => handleBid('down')}
              >
                ↓ Lower bid
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const AnomalyDetailEmpty = () => (
  <div className={styles.empty}>
    <svg
      className={styles.emptyIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <p className={styles.emptyText}>Select an anomaly to inspect</p>
  </div>
);