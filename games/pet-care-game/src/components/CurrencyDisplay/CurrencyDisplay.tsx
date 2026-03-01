import { useGameStore } from '../../store/useGameStore';
import styles from './CurrencyDisplay.module.css';

export function CurrencyDisplay() {
  const currency = useGameStore(s => s.currency);

  return (
    <div className={styles.display}>
      <span className={styles.icon}>🪙</span>
      <span className={styles.amount}>{currency}</span>
    </div>
  );
}
