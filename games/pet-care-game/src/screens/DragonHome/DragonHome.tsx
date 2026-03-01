import { useGameStore } from '../../store/useGameStore';
import { CurrencyDisplay } from '../../components/CurrencyDisplay/CurrencyDisplay';
import { Dragon } from '../../components/Dragon/Dragon';
import { ELEMENT_PALETTES } from '../../assets/colors';
import { DAILY_INCOME_COINS, INCOME_INTERVAL_MS } from '../../engine/constants';
import type { DragonElement } from '../../store/gameStoreTypes';
import styles from './DragonHome.module.css';

export function DragonHome() {
  const navigate = useGameStore(s => s.navigate);
  const dragon = useGameStore(s => s.dragon);
  const lovedDragons = useGameStore(s => s.lovedDragons);
  const wildDragons = useGameStore(s => s.wildDragons);
  const collectDailyIncome = useGameStore(s => s.collectDailyIncome);

  const handleCollect = () => {
    const earned = collectDailyIncome();
    if (earned > 0) {
      alert(`Collected ${earned} coins from your loving dragons!`);
    }
  };

  const getTimeUntilIncome = (lastIncomeAt: number) => {
    const next = lastIncomeAt + INCOME_INTERVAL_MS;
    const remaining = Math.max(0, next - Date.now());
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return remaining > 0 ? `${hours}h ${mins}m` : 'Ready!';
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>Dragon Home</h2>
        <CurrencyDisplay />
      </div>

      {dragon && (
        <div className={styles.activeSection}>
          <h3 className={styles.sectionTitle}>Active Dragon</h3>
          <button className={styles.activeCard} onClick={() => navigate('main-care')}>
            <div className={styles.miniDragon}>
              <Dragon stage={dragon.stage} element={dragon.element} mood="happy" />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>{dragon.name}</span>
              <span className={styles.cardDetail}>{dragon.element} dragon</span>
              <span className={styles.cardDetail}>Love: {Math.floor(dragon.love)}%</span>
            </div>
            <span className={styles.goArrow}>Go</span>
          </button>
        </div>
      )}

      {lovedDragons.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Loved Dragons (${DAILY_INCOME_COINS}/day each)</h3>
            <button className={styles.collectBtn} onClick={handleCollect}>Collect</button>
          </div>
          <div className={styles.grid}>
            {lovedDragons.map(d => (
              <div key={d.id} className={styles.card} style={{ borderColor: ELEMENT_PALETTES[d.element].primary }}>
                <div className={styles.miniDragonSmall}>
                  <Dragon stage={5} element={d.element} mood="happy" />
                </div>
                <span className={styles.cardName}>{d.name}</span>
                <span className={styles.cardEarning}>Earned: {d.totalEarned} coins</span>
                <span className={styles.cardTimer}>{getTimeUntilIncome(d.lastIncomeAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {wildDragons.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Wild Dragons</h3>
          <div className={styles.grid}>
            {wildDragons.map(d => (
              <div key={d.id} className={styles.card} style={{ borderColor: ELEMENT_PALETTES[d.element as DragonElement]?.primary ?? '#888' }}>
                <div className={styles.miniDragonSmall}>
                  <Dragon stage={5} element={d.element as DragonElement} mood="neutral" />
                </div>
                <span className={styles.cardName}>{d.name}</span>
                <span className={styles.cardDetail}>
                  {d.status === 'returned' ? 'Returned!' : 'Exploring...'}
                </span>
                <span className={styles.cardEarning}>Prizes: {d.totalPrizesCollected}</span>
              </div>
            ))}
          </div>
          <button className={styles.linkBtn} onClick={() => navigate('wild-dragons')}>
            View Wild Dragons
          </button>
        </div>
      )}

      {!dragon && lovedDragons.length === 0 && wildDragons.length === 0 && (
        <div className={styles.empty}>
          <p>No dragons yet! Buy an egg to get started.</p>
        </div>
      )}

      <div className={styles.navBar}>
        {dragon && (
          <button className={styles.navBtn} onClick={() => navigate('main-care')}>
            Back to Dragon
          </button>
        )}
        <button className={styles.navBtn} onClick={() => navigate('egg-shop')}>
          Egg Shop
        </button>
      </div>
    </div>
  );
}
