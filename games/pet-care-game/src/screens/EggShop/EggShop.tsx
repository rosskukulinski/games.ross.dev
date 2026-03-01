import { useGameStore } from '../../store/useGameStore';
import { EGG_TYPES } from '../../assets/eggTypes';
import { ELEMENT_PALETTES } from '../../assets/colors';
import { Egg } from '../../components/Egg/Egg';
import { CurrencyDisplay } from '../../components/CurrencyDisplay/CurrencyDisplay';
import styles from './EggShop.module.css';

export function EggShop() {
  const buyEgg = useGameStore(s => s.buyEgg);
  const currency = useGameStore(s => s.currency);
  const navigate = useGameStore(s => s.navigate);
  const dragon = useGameStore(s => s.dragon);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>Choose Your Egg</h2>
        <CurrencyDisplay />
      </div>

      <div className={styles.grid}>
        {EGG_TYPES.map(egg => {
          const palette = ELEMENT_PALETTES[egg.element];
          const canBuy = currency >= egg.cost;

          return (
            <button
              key={egg.element}
              className={`${styles.card} ${!canBuy ? styles.cantAfford : ''}`}
              style={{ borderColor: palette.primary }}
              onClick={() => buyEgg(egg.element)}
              disabled={!canBuy}
            >
              <Egg element={egg.element} size={80} />
              <h3 className={styles.eggName} style={{ color: palette.primary }}>{egg.name}</h3>
              <p className={styles.eggDesc}>{egg.description}</p>
              <span className={styles.price}>
                {canBuy ? `🪙 ${egg.cost}` : `Need ${egg.cost - currency} more`}
              </span>
            </button>
          );
        })}
      </div>

      {dragon && (
        <button className={styles.backBtn} onClick={() => navigate('main-care')}>
          Back
        </button>
      )}
    </div>
  );
}
