import type { ReactNode } from 'react';
import styles from './SummaryCards.module.css';

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

interface SummaryCardsProps {
  cards: SummaryCardProps[];
}

const variantClassMap = {
  neutral: styles.neutral,
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
  info: styles.info,
} as const;

export const SummaryCard = ({ label, value, icon, variant = 'neutral' }: SummaryCardProps) => (
  <div className={`${styles.card} ${variantClassMap[variant]}`}>
    <div className={styles.icon}>{icon}</div>
    <span className={styles.value}>{value}</span>
    <span className={styles.label}>{label}</span>
  </div>
);

export const SummaryCards = ({ cards }: SummaryCardsProps) => (
  <div className={styles.cards}>
    {cards.map((card, index) => (
      <SummaryCard key={index} {...card} />
    ))}
  </div>
);

export type { SummaryCardProps, SummaryCardsProps };