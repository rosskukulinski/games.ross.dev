import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { RACE_DURATION, MAX_SPEED, SPEED_GAIN_PER_TAP, SPEED_DECAY_PER_SECOND, DISTANCE_FACTOR, calculateReward } from './dragonRacingLogic';
import styles from './DragonRacing.module.css';

export function DragonRacing() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(RACE_DURATION);

  const [gameStarted, setGameStarted] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [reward, setReward] = useState(0);
  const speedRef = useRef(0);
  const distanceRef = useRef(0);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);

  const gameLoop = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    // Decay speed
    speedRef.current = Math.max(0, speedRef.current - SPEED_DECAY_PER_SECOND * delta);
    // Add distance
    distanceRef.current += speedRef.current * DISTANCE_FACTOR * delta;

    setSpeed(speedRef.current);
    setDistance(distanceRef.current);

    frameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setSpeed(0);
    setDistance(0);
    setReward(0);
    speedRef.current = 0;
    distanceRef.current = 0;
    lastTimeRef.current = 0;
    start();
    frameRef.current = requestAnimationFrame(gameLoop);
  }, [start, gameLoop]);

  useEffect(() => {
    if (isFinished && frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    return () => cancelAnimationFrame(frameRef.current);
  }, [isFinished]);

  const handleTap = () => {
    if (!isRunning) return;
    speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_GAIN_PER_TAP);
    setSpeed(speedRef.current);
  };

  if (isFinished && gameStarted && reward === 0) {
    const r = calculateReward(distanceRef.current);
    setReward(r);
    addCurrency(r);
  }

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>Dragon Racing</h2>
          <p>Tap rapidly to build speed and race your dragon!</p>
          <p className={styles.tip}>Speed decays over time — keep tapping!</p>
          <button className={styles.startBtn} onClick={startGame}>Race!</button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className={styles.screen}>
        <div className={styles.results}>
          <h2>Race Over!</h2>
          <p className={styles.scoreDisplay}>Distance: {Math.floor(distance)}m</p>
          <p className={styles.rewardDisplay}>+{reward} coins</p>
          <button className={styles.startBtn} onClick={() => { setReward(0); setGameStarted(false); }}>
            Race Again
          </button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back to Hub</button>
        </div>
      </div>
    );
  }

  const speedPercent = Math.floor((speed / MAX_SPEED) * 100);
  const dragonX = Math.min(80, (distance / 1000) * 80);

  return (
    <div className={styles.screen}>
      <div className={styles.hud}>
        <span className={styles.timer}>⏱ {timeLeft}s</span>
        <span className={styles.dist}>{Math.floor(distance)}m</span>
      </div>

      <div className={styles.track}>
        <div className={styles.ground} />
        <div className={styles.dragonRunner} style={{ left: `${5 + dragonX}%` }}>
          🐉
        </div>
        <div className={styles.finishLine} />
      </div>

      <div className={styles.speedBar}>
        <div className={styles.speedFill} style={{ width: `${speedPercent}%` }} />
        <span className={styles.speedLabel}>Speed: {speedPercent}%</span>
      </div>

      <button className={styles.tapBtn} onClick={handleTap}>
        TAP TO RUN!
      </button>
    </div>
  );
}
