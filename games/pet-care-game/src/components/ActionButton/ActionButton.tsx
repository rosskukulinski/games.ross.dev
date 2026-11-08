import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { CareAction } from '../../engine/actions';
import styles from './ActionButton.module.css';

interface ActionButtonProps {
  action: CareAction;
  disabled?: boolean;
  onPerformAction?: (actionId: string) => void;
}

export function ActionButton({ action, disabled, onPerformAction }: ActionButtonProps) {
  const performAction = useGameStore(s => s.performAction);
  const cooldownEnd = useGameStore(s => s.dragon?.actionCooldowns[action.id] ?? 0);
  const currency = useGameStore(s => s.currency);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  // Bumped on every tap so the pop / shake animation restarts each time
  const [tapKey, setTapKey] = useState(0);
  const [blocked, setBlocked] = useState<'wait' | 'coins' | null>(null);
  const blockedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, (cooldownEnd - Date.now()) / 1000);
      setCooldownLeft(left);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  useEffect(() => () => clearTimeout(blockedTimer.current), []);

  const onCooldown = cooldownLeft > 0;
  const cantAfford = action.currencyCost ? currency < action.currencyCost : false;
  const isDisabled = disabled || onCooldown || cantAfford;
  const cooldownPct = onCooldown ? (cooldownLeft / action.cooldownSeconds) * 100 : 0;

  // The button never uses the `disabled` attribute: a tap while it is resting
  // still answers (a shake plus an hourglass or coin) instead of doing nothing.
  const handleClick = () => {
    setTapKey(k => k + 1);
    if (isDisabled) {
      clearTimeout(blockedTimer.current);
      setBlocked(cantAfford && !onCooldown ? 'coins' : 'wait');
      blockedTimer.current = setTimeout(() => setBlocked(null), 900);
      return;
    }
    setBlocked(null);
    performAction(action.id);
    onPerformAction?.(action.id);
  };

  return (
    <button
      className={`${styles.button} ${isDisabled ? styles.disabled : ''}`}
      onClick={handleClick}
      aria-disabled={isDisabled}
      aria-label={action.label}
    >
      <span key={tapKey} className={`${styles.icon} ${tapKey ? (blocked ? styles.shake : styles.pop) : ''}`}>
        {action.icon}
      </span>
      <span className={styles.label}>{action.label}</span>
      {action.currencyCost && (
        <span className={styles.cost}>{action.currencyCost}🪙</span>
      )}
      {onCooldown && (
        <div
          className={styles.cooldownOverlay}
          style={{ background: `conic-gradient(rgba(90, 70, 150, 0.35) ${cooldownPct}%, transparent 0)` }}
          aria-hidden="true"
        >
          <span className={styles.cooldownIcon}>⏳</span>
        </div>
      )}
      {blocked && (
        <span key={`b${tapKey}`} className={styles.blockedBubble} aria-hidden="true">
          {blocked === 'coins' ? '🪙❓' : '⏳'}
        </span>
      )}
    </button>
  );
}
