import type { CampaignGroup } from '../../types/anomaly';
import styles from './CampaignTabs.module.css';

interface CampaignTabsProps {
  groups: CampaignGroup[];
  activeCampaignId: string | null;
  onSelect: (campaignId: string | null) => void;
}

export const CampaignTabs = ({ groups, activeCampaignId, onSelect }: CampaignTabsProps) => {
  if (groups.length === 0) return null;

  const isAllActive = activeCampaignId === null;

  return (
    <div className={styles.tabs} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={isAllActive}
        className={`${styles.tab} ${isAllActive ? styles.active : ''}`}
        onClick={() => onSelect(null)}
      >
        All campaigns
        <span className={styles.count}>
          {groups.reduce((sum, g) => sum + g.anomalies.length, 0)}
        </span>
      </button>
      {groups.map((group) => {
        const isActive = activeCampaignId === group.campaignId;
        return (
          <button
            key={group.campaignId}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onSelect(group.campaignId)}
          >
            {group.campaignId}
            <span className={styles.count}>{group.anomalies.length}</span>
          </button>
        );
      })}
    </div>
  );
};