import { useGameStore } from '../../store/useGameStore';
import styles from './TitleScreen.module.css';

export function TitleScreen() {
  const navigate = useGameStore(s => s.navigate);
  const dragon = useGameStore(s => s.dragon);

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Dragon</h1>
          <h1 className={styles.title2}>Keeper</h1>
          <p className={styles.subtitle}>Raise. Release. Repeat.</p>
        </div>

        <div className={styles.dragonSilhouette}>
          <svg viewBox="0 0 200 150" className={styles.silhouette}>
            <path
              d="M60 120 Q40 100 50 80 Q55 60 70 55 Q75 45 85 50 Q90 40 100 42 Q110 40 115 50 Q125 45 130 55 Q145 60 150 80 Q160 100 140 120 Z"
              fill="rgba(139, 92, 246, 0.15)"
            />
            <circle cx="85" cy="70" r="3" fill="rgba(139, 92, 246, 0.3)" />
            <circle cx="115" cy="70" r="3" fill="rgba(139, 92, 246, 0.3)" />
          </svg>
        </div>

        <div className={styles.buttons}>
          {dragon && (
            <button className={styles.continueBtn} onClick={() => navigate('main-care')}>
              Continue
            </button>
          )}
          <button
            className={dragon ? styles.newGameBtn : styles.continueBtn}
            onClick={() => {
              if (dragon) {
                if (confirm('Start a new game? This will reset all progress.')) {
                  useGameStore.getState().resetGame();
                  navigate('egg-shop');
                }
              } else {
                navigate('egg-shop');
              }
            }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
