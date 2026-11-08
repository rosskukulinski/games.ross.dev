import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Egg } from '../../components/Egg/Egg';
import { Dragon } from '../../components/Dragon/Dragon';
import { HATCH_TIME, HATCH_TAP_BOOST } from '../../engine/constants';
import { randomDragonName } from '../../assets/dragonNames';
import styles from './HatchingScreen.module.css';

interface Spark {
  id: number;
  x: number;
  emoji: string;
}

const SPARK_EMOJI = ['✨', '💛', '🔥', '⭐', '💖'];

export function HatchingScreen() {
  const hatchingElement = useGameStore(s => s.hatchingElement);
  const hatchStartedAt = useGameStore(s => s.hatchStartedAt);
  const hatchEgg = useGameStore(s => s.hatchEgg);
  const [phase, setPhase] = useState<'waiting' | 'cracking' | 'hatched'>('waiting');
  const [name, setName] = useState(() => (hatchingElement ? randomDragonName(hatchingElement) : 'Pip'));
  const [progress, setProgress] = useState(0);
  const [boost, setBoost] = useState(0);
  const [bump, setBump] = useState(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const sparkId = useRef(0);

  useEffect(() => {
    if (!hatchStartedAt) return;

    const tick = () => {
      const elapsed = (Date.now() - hatchStartedAt) / 1000 + boost;
      const pct = Math.min(100, (elapsed / HATCH_TIME) * 100);
      setProgress(pct);
      if (pct >= 100) setPhase('hatched');
      else if (pct >= 80) setPhase(p => (p === 'waiting' ? 'cracking' : p));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [hatchStartedAt, boost]);

  if (!hatchingElement) return null;

  const warmEgg = () => {
    if (phase === 'hatched') return;
    setBoost(b => b + HATCH_TAP_BOOST);
    setBump(b => b + 1);
    const id = ++sparkId.current;
    const spark = { id, x: 20 + Math.random() * 60, emoji: SPARK_EMOJI[id % SPARK_EMOJI.length] };
    setSparks(s => [...s.slice(-5), spark]);
    setTimeout(() => setSparks(s => s.filter(p => p.id !== id)), 900);
  };

  const finalName = name.trim() || randomDragonName(hatchingElement);
  const handleHatch = () => hatchEgg(finalName);

  return (
    <div className={styles.screen}>
      {phase !== 'hatched' ? (
        <div className={styles.eggArea}>
          <button
            type="button"
            className={styles.eggBtn}
            onClick={warmEgg}
            aria-label="Tap the egg to warm it up"
          >
            <span key={bump} className={bump ? styles.eggBump : undefined}>
              <Egg element={hatchingElement} cracking={phase === 'cracking'} size={170} />
            </span>
            {sparks.map(s => (
              <span key={s.id} className={styles.spark} style={{ left: `${s.x}%` }}>{s.emoji}</span>
            ))}
            <span className={styles.tapHand} aria-hidden="true">👆</span>
          </button>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.hint}>
            {phase === 'waiting' ? '👆 Tap to warm your egg!' : '🥚 Almost there! Keep tapping!'}
          </p>
        </div>
      ) : (
        <div className={styles.hatchedArea}>
          <div className={styles.babyDragon}>
            <Dragon stage={1} element={hatchingElement} mood="happy" />
          </div>
          <h2 className={styles.congrats}>✨ It hatched! ✨</h2>
          <div className={styles.nameRow}>
            <input
              className={styles.nameInput}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleHatch()}
              onFocus={e => e.currentTarget.select()}
              placeholder="Name your dragon"
              aria-label="Dragon name"
              maxLength={20}
            />
            <button
              type="button"
              className={styles.diceBtn}
              onClick={() => setName(randomDragonName(hatchingElement, name))}
              aria-label="Pick a different name"
            >
              🎲
            </button>
          </div>
          <button className={styles.confirmBtn} onClick={handleHatch}>
            🐉 Start Your Journey
          </button>
        </div>
      )}
    </div>
  );
}
