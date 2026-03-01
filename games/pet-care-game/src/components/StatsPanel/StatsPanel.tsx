import { useGameStore } from '../../store/useGameStore';
import { StatBar } from '../StatBar/StatBar';
import styles from './StatsPanel.module.css';

const STAT_CONFIG = [
  { key: 'hunger' as const, label: 'Hunger', icon: '🍖', color: '#e76f51' },
  { key: 'thirst' as const, label: 'Thirst', icon: '💧', color: '#457b9d' },
  { key: 'happiness' as const, label: 'Happy', icon: '😊', color: '#f4a261' },
  { key: 'energy' as const, label: 'Energy', icon: '⚡', color: '#e9c46a' },
  { key: 'hygiene' as const, label: 'Hygiene', icon: '✨', color: '#2a9d8f' },
  { key: 'health' as const, label: 'Health', icon: '❤️', color: '#e63946' },
];

export function StatsPanel() {
  const stats = useGameStore(s => s.dragon?.stats);
  if (!stats) return null;

  return (
    <div className={styles.panel}>
      {STAT_CONFIG.map(({ key, label, icon, color }) => (
        <StatBar key={key} label={label} icon={icon} value={stats[key]} color={color} />
      ))}
    </div>
  );
}
