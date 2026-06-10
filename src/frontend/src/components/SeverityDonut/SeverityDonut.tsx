import styles from './SeverityDonut.module.css';

interface SeverityDonutProps {
  critical: number;
  high: number;
  medium: number;
}

interface Segment {
  label: string;
  value: number;
  color: string;
  textColor: string;
  bgColor: string;
}

const SIZE = 140;
const RADIUS = 56;
const STROKE = 18;

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (startAngle: number, endAngle: number): string => {
  const start = polarToCartesian(SIZE / 2, SIZE / 2, RADIUS, endAngle);
  const end = polarToCartesian(SIZE / 2, SIZE / 2, RADIUS, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

export const SeverityDonut = ({ critical, high, medium }: SeverityDonutProps) => {
  const total = critical + high + medium;
  const segments: Segment[] = [
    { label: 'Critical', value: critical, color: '#E24B4A', textColor: '#A32D2D', bgColor: '#FCEBEB' },
    { label: 'High', value: high, color: '#EF9F27', textColor: '#854F0B', bgColor: '#FAEEDA' },
    { label: 'Medium', value: medium, color: '#378ADD', textColor: '#185FA5', bgColor: '#E6F1FB' },
  ];

  if (total === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>Severity distribution</h3>
        <p className={styles.empty}>No anomalies to display</p>
      </div>
    );
  }

  let cumulative = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const startAngle = (cumulative / total) * 360;
      cumulative += s.value;
      const endAngle = (cumulative / total) * 360;
      return { ...s, startAngle, endAngle };
    });

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Severity distribution</h3>
      <div className={styles.donutWrapper}>
        <svg width={SIZE} height={SIZE} className={styles.donut}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-bg-subtle)"
            strokeWidth={STROKE}
          />
          {arcs.map((a, idx) => (
            <path
              key={idx}
              d={arcPath(a.startAngle, a.endAngle)}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
            />
          ))}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.totalText}
          >
            {total}
          </text>
          <text
            x="50%"
            y="62%"
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.totalLabel}
          >
            total
          </text>
        </svg>
        <ul className={styles.legend}>
          {segments.map((s) => (
            <li key={s.label} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: s.color }}
                aria-hidden
              />
              <span className={styles.legendLabel}>{s.label}</span>
              <span
                className={styles.legendValue}
                style={{ color: s.textColor }}
              >
                {s.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};