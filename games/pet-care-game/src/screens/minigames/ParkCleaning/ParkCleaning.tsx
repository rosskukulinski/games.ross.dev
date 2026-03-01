import { useState, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { generateTrashItems, calculateReward, getTrashIcon } from './parkCleaningLogic';
import type { TrashItem } from './parkCleaningLogic';
import styles from './ParkCleaning.module.css';

const GAME_TIME = 30;
const TRASH_COUNT = 20;

export function ParkCleaning() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(GAME_TIME);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [reward, setReward] = useState(0);

  const startGame = useCallback(() => {
    setItems(generateTrashItems(TRASH_COUNT));
    setScore(0);
    setGameStarted(true);
    start();
  }, [start]);

  const collectItem = useCallback((id: string, hidden: boolean) => {
    if (!isRunning) return;
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, collected: true } : item
    ));
    setScore(prev => prev + (hidden ? 2 : 1));
  }, [isRunning]);

  // Calculate reward when game ends
  if (isFinished && gameStarted && reward === 0) {
    const r = calculateReward(score, TRASH_COUNT);
    setReward(r);
    addCurrency(r);
  }

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>🌳 Clean the Park</h2>
          <p>Tap the trash items to clean them up!</p>
          <p className={styles.tip}>Hidden items (partially transparent) are worth 2x!</p>
          <button className={styles.startBtn} onClick={startGame}>Start!</button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className={styles.screen}>
        <div className={styles.results}>
          <h2>Time's Up!</h2>
          <p className={styles.scoreDisplay}>Score: {score}</p>
          <p className={styles.rewardDisplay}>+{reward} 🪙</p>
          {score >= TRASH_COUNT && <p className={styles.perfect}>Perfect Clean! +10 bonus!</p>}
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
        <span className={styles.timer}>⏱ {timeLeft}s</span>
        <span className={styles.score}>Score: {score}</span>
      </div>
      <div className={styles.parkArea}>
        {/* Park background elements */}
        <div className={styles.grass} />
        {items.map(item => !item.collected && (
          <button
            key={item.id}
            className={`${styles.trashItem} ${item.hidden ? styles.hidden : ''}`}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onClick={() => collectItem(item.id, item.hidden)}
          >
            {getTrashIcon(item.type)}
          </button>
        ))}
      </div>
    </div>
  );
}
