export type AnomalyStatus = 'pending' | 'approved' | 'rejected';
export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AnomalyWithStatus {
  id: string;
  campaignId: string;
  date: string;
  type: string;
  severity: AnomalySeverity;
  title: string;
  insight: string;
  description?: string;
  suggestedAction: string;
  confidence: number;
  score: number;
  signal: string;
  metrics: {
    acos: number;
    roas: number;
    spend: number;
  };
  metadata: Record<string, unknown>;
  status: AnomalyStatus;
}

export interface CampaignGroup {
  campaignId: string;
  anomalies: AnomalyWithStatus[];
  topSeverity: AnomalySeverity;
  pendingCount: number;
}
