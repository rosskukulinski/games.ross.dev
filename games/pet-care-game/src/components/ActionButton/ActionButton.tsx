import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, (cooldownEnd - Date.now()) / 1000);
      setCooldownLeft(left);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const onCooldown = cooldownLeft > 0;
  const cantAfford = action.currencyCost ? currency < action.currencyCost : false;
  const isDisabled = disabled || onCooldown || cantAfford;

  return (
    <button
      className={`${styles.button} ${isDisabled ? styles.disabled : ''}`}
      onClick={() => { performAction(action.id); onPerformAction?.(action.id); }}
      disabled={isDisabled}
    >
      <span className={styles.icon}>{action.icon}</span>
      <span className={styles.label}>{action.label}</span>
      {action.currencyCost && (
        <span className={styles.cost}>{action.currencyCost}🪙</span>
      )}
      {onCooldown && (
        <div className={styles.cooldownOverlay}>
          {Math.ceil(cooldownLeft)}s
        </div>
      )}
    </button>
  );
}
