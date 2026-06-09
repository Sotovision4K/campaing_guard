import type { ValidatedAnomaly } from '../../types';

type Severity = ValidatedAnomaly['severity'];

const severityClass: Record<Severity, string> = {
  CRITICAL: 'severity-critical',
  HIGH: 'severity-high',
  MEDIUM: 'severity-medium',
  LOW: 'severity-low',
};

export const SeverityBadge = ({ severity, size = 'md' }: SeverityBadgeProps) => {
  return (
    <span className={`severity-badge ${severityClass[severity]} severity-badge--${size}`}>
      {severity}
    </span>
  );
};