import { useState } from 'react';
import type { ValidatedAnomaly } from '../../types';
import { SeverityBadge } from './SeverityBadge';
import './AnomalyCard.css';

export type AnomalyAction = 'approve' | 'reject' | 'increase-bid' | 'lower-bid';

interface AnomalyCardProps {
  anomaly: ValidatedAnomaly;
  isExpanded: boolean;
  onToggle: () => void;
  onAction: (anomalyId: string, action: AnomalyAction) => Promise<void>;
}

export const AnomalyCard = ({ anomaly, isExpanded, onToggle, onAction }: AnomalyCardProps) => {
  const [actionStatus, setActionStatus] = useState<{ type: AnomalyAction; done: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confidencePercent = Math.round(anomaly.confidence * 100);

  const handleAction = async (action: AnomalyAction) => {
    setIsLoading(true);
    try {
      await onAction(anomaly.id, action);
      setActionStatus({ type: action, done: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`anomaly-card ${isExpanded ? 'anomaly-card--expanded' : ''}`}>
      <button className="anomaly-card__header" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="anomaly-card__title-row">
          <SeverityBadge severity={anomaly.severity} size="sm" />
          <span className="anomaly-card__title">{anomaly.title}</span>
        </div>
        <div className="anomaly-card__meta">
          <span className="anomaly-card__date">{anomaly.date}</span>
          <span className="anomaly-card__confidence">{confidencePercent}% confidence</span>
        </div>
        <span className={`anomaly-card__chevron ${isExpanded ? 'anomaly-card__chevron--up' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="anomaly-card__details">
          <div className="anomaly-card__section">
            <h4 className="anomaly-card__section-title">Insight</h4>
            <p className="anomaly-card__insight">{anomaly.insight}</p>
          </div>

          <div className="anomaly-card__section">
            <h4 className="anomaly-card__section-title">Suggested Action</h4>
            <p className="anomaly-card__action">{anomaly.suggestedAction}</p>
          </div>

          <div className="anomaly-card__section">
            <h4 className="anomaly-card__section-title">Type</h4>
            <p className="anomaly-card__type">{anomaly.type}</p>
          </div>

          {Object.keys(anomaly.metadata).length > 0 && (
            <div className="anomaly-card__section">
              <h4 className="anomaly-card__section-title">Metadata</h4>
              <pre className="anomaly-card__metadata">
                {JSON.stringify(anomaly.metadata, null, 2)}
              </pre>
            </div>
          )}

          <div className="anomaly-card__actions">
            <button
              className="btn btn--reject"
              onClick={() => handleAction('reject')}
              disabled={isLoading}
            >
              Reject
            </button>
            <button
              className="btn btn--approve"
              onClick={() => handleAction('approve')}
              disabled={isLoading}
            >
              Approve
            </button>
            <button
              className="btn btn--increase-bid"
              onClick={() => handleAction('increase-bid')}
              disabled={isLoading}
            >
              Increase Bid
            </button>
            <button
              className="btn btn--lower-bid"
              onClick={() => handleAction('lower-bid')}
              disabled={isLoading}
            >
              Lower Bid
            </button>
          </div>

          {actionStatus?.done && (
            <div className="anomaly-card__feedback">
              DONE!
            </div>
          )}
        </div>
      )}
    </div>
  );
};