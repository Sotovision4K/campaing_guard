import { useMemo } from 'react';
import type { ValidatedAnomaly, SeverityCount } from '../types';

export interface CampaignGroup {
  campaignId: string;
  anomalies: ValidatedAnomaly[];
  severityCounts: SeverityCount;
  totalAnomalies: number;
  criticalCount: number;
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const sortBySeverity = (anomalies: ValidatedAnomaly[]): ValidatedAnomaly[] => {
  return [...anomalies].sort((a, b) => {
    const aIndex = SEVERITY_ORDER.indexOf(a.severity);
    const bIndex = SEVERITY_ORDER.indexOf(b.severity);
    return aIndex - bIndex;
  });
};

const calculateSeverityCounts = (anomalies: ValidatedAnomaly[]): SeverityCount => {
  return anomalies.reduce(
    (acc, anomaly) => {
      acc[anomaly.severity]++;
      return acc;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  );
};

export const useCampaignAnomalies = (anomaliesByCampaign: Record<string, ValidatedAnomaly[]> | null) => {
  const groups = useMemo<CampaignGroup[]>(() => {
    if (!anomaliesByCampaign) return [];

    const campaignGroups: CampaignGroup[] = Object.entries(anomaliesByCampaign).map(
      ([campaignId, anomalies]) => {
        const sortedAnomalies = sortBySeverity(anomalies);
        const severityCounts = calculateSeverityCounts(sortedAnomalies);
        return {
          campaignId,
          anomalies: sortedAnomalies,
          severityCounts,
          totalAnomalies: anomalies.length,
          criticalCount: severityCounts.CRITICAL,
        };
      }
    );

    return campaignGroups.sort((a, b) => b.criticalCount - a.criticalCount);
  }, [anomaliesByCampaign]);

  const totalAnomalies = useMemo(
    () => groups.reduce((sum, g) => sum + g.totalAnomalies, 0),
    [groups]
  );

  const criticalCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.criticalCount, 0),
    [groups]
  );

  return {
    groups,
    totalAnomalies,
    criticalCount,
  };
};