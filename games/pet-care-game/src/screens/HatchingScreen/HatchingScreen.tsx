import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Egg } from '../../components/Egg/Egg';
import { HATCH_TIME } from '../../engine/constants';
import styles from './HatchingScreen.module.css';

export function HatchingScreen() {
  const hatchingElement = useGameStore(s => s.hatchingElement);
  const hatchStartedAt = useGameStore(s => s.hatchStartedAt);
  const hatchEgg = useGameStore(s => s.hatchEgg);
  const [phase, setPhase] = useState<'waiting' | 'cracking' | 'hatched'>('waiting');
  const [name, setName] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!hatchStartedAt) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - hatchStartedAt) / 1000;
      const pct = Math.min(100, (elapsed / HATCH_TIME) * 100);
      setProgress(pct);

      if (pct >= 80 && phase === 'waiting') {
        setPhase('cracking');
      }
      if (pct >= 100 && phase !== 'hatched') {
        setPhase('hatched');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [hatchStartedAt, phase]);

  if (!hatchingElement) return null;

  const handleHatch = () => {
    if (name.trim()) {
      hatchEgg(name.trim());
    }
  };

  return (
    <div className={styles.screen}>
      {phase !== 'hatched' ? (
        <div className={styles.eggArea}>
          <Egg element={hatchingElement} cracking={phase === 'cracking'} size={160} />
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.hint}>
            {phase === 'waiting' ? 'Your egg is warming up...' : 'Almost there!'}
          </p>
        </div>
      ) : (
        <div className={styles.hatchedArea}>
          <div className={styles.sparkle}>
            <span className={styles.sparkleEmoji}>✨</span>
          </div>
          <h2 className={styles.congrats}>It hatched!</h2>
          <p className={styles.prompt}>Name your dragon:</p>
          <input
            className={styles.nameInput}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleHatch()}
            placeholder="Enter a name..."
            maxLength={20}
            autoFocus
          />
          <button
            className={styles.confirmBtn}
            onClick={handleHatch}
            disabled={!name.trim()}
          >
            Start Your Journey
          </button>
        </div>
      )}
    </div>
  );
}
