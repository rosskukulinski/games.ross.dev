import { useGameStore } from '../../store/useGameStore';
import { CurrencyDisplay } from '../CurrencyDisplay/CurrencyDisplay';
import { STAGE_NAMES } from '../../assets/dragonStages';
import styles from './Header.module.css';

export function Header() {
  const dragon = useGameStore(s => s.dragon);
  const navigate = useGameStore(s => s.navigate);
  const wildDragons = useGameStore(s => s.wildDragons);
  const returnedCount = wildDragons.filter(d => d.status === 'returned').length;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {dragon && (
          <div className={styles.dragonInfo}>
            <span className={styles.name}>{dragon.name}</span>
            <span className={styles.stage}>{STAGE_NAMES[dragon.stage]}</span>
          </div>
        )}
      </div>
      <div className={styles.right}>
        {wildDragons.length > 0 && (
          <button className={styles.wildButton} onClick={() => navigate('wild-dragons')}>
            🐉 {wildDragons.length}
            {returnedCount > 0 && <span className={styles.badge}>{returnedCount}</span>}
          </button>
        )}
        <CurrencyDisplay />
      </div>
    </header>
  );
}
