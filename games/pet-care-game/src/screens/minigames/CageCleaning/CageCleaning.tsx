import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { generateDirtSpots, scrubRate, calculateReward, getDirtEmoji } from './cageCleaningLogic';
import type { DirtSpot } from './cageCleaningLogic';
import styles from './CageCleaning.module.css';

const GAME_TIME = 40;
const SPOT_COUNT = 10;

export function CageCleaning() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const dragon = useGameStore(s => s.dragon);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(GAME_TIME);

  const [spots, setSpots] = useState<DirtSpot[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [reward, setReward] = useState(0);
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const scrubInterval = useRef<ReturnType<typeof setInterval>>(null);

  const startGame = useCallback(() => {
    setSpots(generateDirtSpots(SPOT_COUNT));
    setGameStarted(true);
    setReward(0);
    start();
  }, [start]);

  const startScrub = useCallback((spotId: string) => {
    if (!isRunning) return;
    setActiveSpot(spotId);
  }, [isRunning]);

  const stopScrub = useCallback(() => {
    setActiveSpot(null);
  }, []);

  // Scrub effect
  useEffect(() => {
    if (!activeSpot || !isRunning) return;

    scrubInterval.current = setInterval(() => {
      setSpots(prev => prev.map(spot => {
        if (spot.id !== activeSpot) return spot;
        const rate = scrubRate(spot.size);
        const newProgress = Math.min(1, spot.cleanProgress + rate * 0.1);
        return { ...spot, cleanProgress: newProgress };
      }));
    }, 100);

    return () => {
      if (scrubInterval.current) clearInterval(scrubInterval.current);
    };
  }, [activeSpot, isRunning]);

  if (isFinished && gameStarted && reward === 0) {
    const r = calculateReward(spots);
    setReward(r);
    addCurrency(r);
    // Hygiene boost
    if (dragon) {
      const store = useGameStore.getState();
      if (store.dragon) {
        useGameStore.setState({
          dragon: {
            ...store.dragon,
            stats: {
              ...store.dragon.stats,
              hygiene: Math.min(100, store.dragon.stats.hygiene + 15),
            },
          },
        });
      }
    }
  }

  const cleanedCount = spots.filter(s => s.cleanProgress >= 1).length;

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>🧹 Clean the Cage</h2>
          <p>Press and hold on dirt spots to scrub them clean!</p>
          <p className={styles.tip}>Clean all spots for a bonus! Also boosts your dragon's hygiene.</p>
          <button className={styles.startBtn} onClick={startGame}>Start!</button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>Time's Up!</h2>
          <p className={styles.scoreDisplay}>{cleanedCount}/{SPOT_COUNT} cleaned</p>
          <p className={styles.rewardDisplay}>+{reward} 🪙</p>
          {cleanedCount === SPOT_COUNT && <p className={styles.perfect}>Perfect Clean! +15 bonus!</p>}
          <p className={styles.hygieneBoost}>+15 Hygiene boost!</p>
          <button className={styles.startBtn} onClick={() => { setReward(0); setGameStarted(false); }}>
            Play Again
          </button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back to Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.hud}>
        <span>⏱ {timeLeft}s</span>
        <span>{cleanedCount}/{SPOT_COUNT} cleaned</span>
      </div>
      <div
        className={styles.cageArea}
        onPointerUp={stopScrub}
        onPointerLeave={stopScrub}
      >
        {spots.map(spot => {
          const isClean = spot.cleanProgress >= 1;
          return (
            <div
              key={spot.id}
              className={`${styles.spot} ${isClean ? styles.clean : ''} ${activeSpot === spot.id ? styles.scrubbing : ''}`}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: spot.radius * 2,
                height: spot.radius * 2,
              }}
              onPointerDown={() => !isClean && startScrub(spot.id)}
            >
              {!isClean && (
                <>
                  <span className={styles.dirtIcon}>{getDirtEmoji(spot.size)}</span>
                  <svg className={styles.progressRing} viewBox="0 0 36 36">
                    <path
                      className={styles.progressBg}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={styles.progressFill}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      strokeDasharray={`${spot.cleanProgress * 100}, 100`}
                    />
                  </svg>
                </>
              )}
              {isClean && <span className={styles.sparkle}>✨</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
