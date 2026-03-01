import styles from './StatBar.module.css';

interface StatBarProps {
  label: string;
  icon: string;
  value: number;
  color: string;
}

export function StatBar({ label, icon, value, color }: StatBarProps) {
  const barColor = value < 20 ? '#e63946' : value < 40 ? '#f4a261' : color;

  return (
    <div className={styles.statBar}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${value}%`, backgroundColor: barColor }}
        />
      </div>
      <span className={styles.value}>{Math.round(value)}</span>
    </div>
  );
}
