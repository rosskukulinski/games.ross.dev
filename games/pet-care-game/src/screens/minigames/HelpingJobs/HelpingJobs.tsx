import { useState, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { generateOrder, checkDelivery, calculateReward, ITEM_ICONS } from './helpingJobsLogic';
import type { JobOrder, ItemType } from './helpingJobsLogic';
import styles from './HelpingJobs.module.css';

const GAME_TIME = 45;
const ALL_ITEMS: ItemType[] = ['potion_red', 'potion_blue', 'book', 'tool', 'food', 'gem'];

export function HelpingJobs() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(GAME_TIME);

  const [gameStarted, setGameStarted] = useState(false);
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [orderNum, setOrderNum] = useState(0);
  const [box, setBox] = useState<ItemType[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reward, setReward] = useState(0);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setScore(0);
    setOrderNum(0);
    setBox([]);
    setOrder(generateOrder(0));
    setReward(0);
    start();
  }, [start]);

  const addToBox = useCallback((type: ItemType) => {
    if (!isRunning) return;
    setBox(prev => [...prev, type]);
  }, [isRunning]);

  const removeFromBox = useCallback((index: number) => {
    if (!isRunning) return;
    setBox(prev => prev.filter((_, i) => i !== index));
  }, [isRunning]);

  const deliver = useCallback(() => {
    if (!order || !isRunning) return;

    if (checkDelivery(order, box)) {
      const points = 10;
      setScore(prev => prev + points);
      setFeedback('Correct! +10');
      const nextNum = orderNum + 1;
      setOrderNum(nextNum);
      setOrder(generateOrder(nextNum));
      setBox([]);
    } else {
      setScore(prev => Math.max(0, prev - 5));
      setFeedback('Wrong! -5');
      setBox([]);
    }
    setTimeout(() => setFeedback(null), 1000);
  }, [order, box, isRunning, orderNum]);

  if (isFinished && gameStarted && reward === 0) {
    const r = calculateReward(score);
    setReward(r);
    addCurrency(r);
  }

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>📦 Helping Jobs</h2>
          <p>Fill orders by selecting the right items!</p>
          <p className={styles.tip}>Tap items to add to box. Tap to remove. Hit Deliver when ready.</p>
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
          <p className={styles.scoreDisplay}>Score: {score}</p>
          <p className={styles.rewardDisplay}>+{reward} 🪙</p>
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
        <span>Score: {score}</span>
      </div>

      {feedback && (
        <div className={`${styles.feedback} ${feedback.includes('+') ? styles.good : styles.bad}`}>
          {feedback}
        </div>
      )}

      {order && (
        <div className={styles.orderCard}>
          <h3 className={styles.orderTitle}>Order #{orderNum + 1}</h3>
          <div className={styles.orderItems}>
            {order.items.map((item, i) => (
              <span key={i} className={styles.orderItem}>
                {ITEM_ICONS[item.type]} x{item.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.boxArea}>
        <h4 className={styles.boxLabel}>Delivery Box:</h4>
        <div className={styles.box}>
          {box.length === 0 ? (
            <span className={styles.emptyBox}>Tap items below to add</span>
          ) : (
            box.map((type, i) => (
              <button key={i} className={styles.boxItem} onClick={() => removeFromBox(i)}>
                {ITEM_ICONS[type]}
              </button>
            ))
          )}
        </div>
        <button className={styles.deliverBtn} onClick={deliver} disabled={box.length === 0}>
          Deliver!
        </button>
      </div>

      <div className={styles.shelf}>
        <h4 className={styles.shelfLabel}>Items:</h4>
        <div className={styles.shelfItems}>
          {ALL_ITEMS.map(type => (
            <button key={type} className={styles.shelfItem} onClick={() => addToBox(type)}>
              {ITEM_ICONS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
