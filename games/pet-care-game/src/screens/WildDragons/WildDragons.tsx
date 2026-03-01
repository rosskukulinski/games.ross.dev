import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useExpeditions } from '../../hooks/useExpeditions';
import { ELEMENT_PALETTES } from '../../assets/colors';
import { getRandomMessage } from '../../assets/expeditionRewards';
import type { DragonElement } from '../../store/gameStoreTypes';
import { CurrencyDisplay } from '../../components/CurrencyDisplay/CurrencyDisplay';
import styles from './WildDragons.module.css';

export function WildDragons() {
  useExpeditions();

  const wildDragons = useGameStore(s => s.wildDragons);
  const collectPrize = useGameStore(s => s.collectPrize);
  const navigate = useGameStore(s => s.navigate);
  const dragon = useGameStore(s => s.dragon);
  const [collectedMsg, setCollectedMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Force re-render every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCollect = (dragonId: string, dragonName: string) => {
    const coins = collectPrize(dragonId);
    if (coins > 0) {
      setCollectedMsg(`${dragonName} ${getRandomMessage()} (+${coins} coins)`);
      setTimeout(() => setCollectedMsg(null), 3000);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>Wild Dragons</h2>
        <CurrencyDisplay />
      </div>

      {collectedMsg && (
        <div className={styles.notification}>{collectedMsg}</div>
      )}

      {wildDragons.length === 0 ? (
        <div className={styles.empty}>
          <p>No dragons in the wild yet.</p>
          <p className={styles.hint}>Raise a dragon to adulthood, then release it!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {wildDragons.map(wd => {
            const palette = ELEMENT_PALETTES[wd.element as DragonElement];
            const isReturned = wd.status === 'returned';
            const timeLeft = Math.max(0, Math.ceil((wd.nextReturnAt - Date.now()) / 1000));
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            return (
              <div
                key={wd.id}
                className={`${styles.card} ${isReturned ? styles.returned : ''}`}
                style={{ borderColor: palette.primary }}
              >
                <div className={styles.cardLeft}>
                  <div className={styles.dragonIcon} style={{ background: palette.primary }}>
                    🐉
                  </div>
                  <div>
                    <h3 className={styles.dragonName}>{wd.name}</h3>
                    <span className={styles.element} style={{ color: palette.primary }}>
                      {wd.element}
                    </span>
                    <span className={styles.totalPrizes}>
                      Total earned: {wd.totalPrizesCollected} 🪙
                    </span>
                  </div>
                </div>

                <div className={styles.cardRight}>
                  {isReturned ? (
                    <button
                      className={styles.collectBtn}
                      onClick={() => handleCollect(wd.id, wd.name)}
                    >
                      Collect Prize!
                    </button>
                  ) : (
                    <div className={styles.exploring}>
                      <span className={styles.exploringLabel}>Exploring...</span>
                      <span className={styles.timer}>
                        {minutes}:{seconds.toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className={styles.backBtn} onClick={() => navigate(dragon ? 'main-care' : 'egg-shop')}>
        Back
      </button>
    </div>
  );
}
