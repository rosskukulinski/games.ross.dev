import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useGameLoop } from '../../hooks/useGameLoop';
import { Dragon, getMood } from '../../components/Dragon/Dragon';
import type { Activity } from '../../components/Dragon/Dragon';
import { StatsPanel } from '../../components/StatsPanel/StatsPanel';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Header } from '../../components/Header/Header';
import { HeartMeter } from '../../components/HeartMeter/HeartMeter';
import { Bed } from '../../components/Bed/Bed';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { CARE_ACTIONS } from '../../engine/actions';
import { isActionUnlocked } from '../../engine/growth';
import styles from './MainCare.module.css';

const ACTIVITY_MAP: Record<string, Activity> = {
  'walk': 'walking',
  'play': 'playing',
  'sleep': 'sleeping',
};

const ACTIVITY_DURATION: Record<Activity, number> = {
  idle: 0,
  walking: 4000,
  playing: 3000,
  sleeping: 5000,
};

export function MainCare() {
  useGameLoop();

  const dragon = useGameStore(s => s.dragon);
  const navigate = useGameStore(s => s.navigate);
  const performAction = useGameStore(s => s.performAction);
  const releaseDragon = useGameStore(s => s.releaseDragon);
  const retireDragon = useGameStore(s => s.retireDragon);
  const hasLovedDragons = useGameStore(s => s.lovedDragons.length > 0);
  const hasWildDragons = useGameStore(s => s.wildDragons.length > 0);

  const [activity, setActivity] = useState<Activity>('idle');
  const [loveFeedback, setLoveFeedback] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ id: number; icon: string } | null>(null);
  const [pending, setPending] = useState<'retire' | 'release' | null>(null);
  const activityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleAction = useCallback((actionId: string) => {
    // Every care tap gets a big reaction over the dragon, even when no love is gained
    const icon = CARE_ACTIONS.find(a => a.id === actionId)?.icon;
    if (icon) {
      clearTimeout(burstTimer.current);
      setBurst({ id: Date.now(), icon });
      burstTimer.current = setTimeout(() => setBurst(null), 1100);
    }

    const newActivity = ACTIVITY_MAP[actionId];
    if (newActivity) {
      clearTimeout(activityTimer.current);
      setActivity(newActivity);
      activityTimer.current = setTimeout(() => setActivity('idle'), ACTIVITY_DURATION[newActivity]);
    }

    // Show love gain feedback
    const dragon = useGameStore.getState().dragon;
    if (dragon) {
      const oldLove = dragon.love;
      // The store already updated love, so check the new state after a tick
      setTimeout(() => {
        const newLove = useGameStore.getState().dragon?.love ?? 0;
        const gain = Math.round(newLove - oldLove);
        if (gain > 0) {
          clearTimeout(feedbackTimer.current);
          setLoveFeedback(`+${gain}`);
          feedbackTimer.current = setTimeout(() => setLoveFeedback(null), 1200);
        }
      }, 50);
    }
  }, []);

  if (!dragon) return null;

  const mood = getMood(dragon.stats);
  const availableActions = CARE_ACTIONS.filter(a => isActionUnlocked(dragon.stage, a.id));
  const canRetire = dragon.stage >= 5 && dragon.love >= 100;
  const sleepUnlocked = isActionUnlocked(dragon.stage, 'sleep');

  const handleBedClick = () => {
    performAction('sleep');
    handleAction('sleep');
  };

  return (
    <div className={styles.screen}>
      <Header />

      <div className={styles.viewport}>
        <div className={styles.heartCorner}>
          <HeartMeter />
          {loveFeedback && (
            <div className={styles.loveFeedback}>{loveFeedback}</div>
          )}
        </div>

        <div key={`dragon-${burst?.id ?? 0}`} className={burst ? styles.dragonHappy : undefined}>
          <Dragon stage={dragon.stage} element={dragon.element} mood={mood} activity={activity} />
        </div>

        {burst && (
          <div key={`burst-${burst.id}`} className={styles.burst} aria-hidden="true">
            <span className={styles.burstIcon}>{burst.icon}</span>
            <span className={styles.burstHeart}>💖</span>
          </div>
        )}

        {sleepUnlocked && (
          <Bed element={dragon.element} isSleeping={activity === 'sleeping'} onClick={handleBedClick} />
        )}

        {canRetire && (
          <button className={styles.retireBtn} onClick={() => setPending('retire')}>
            Retire with Love 💖
          </button>
        )}

        {dragon.stage >= 5 && !canRetire && (
          <button className={styles.releaseBtn} onClick={() => setPending('release')}>
            Release into the Wild 🌿
          </button>
        )}
      </div>

      <div className={styles.bottomPanel}>
        <StatsPanel />

        <div className={styles.actions}>
          {availableActions.map(action => (
            <ActionButton key={action.id} action={action} onPerformAction={handleAction} />
          ))}
        </div>

        <div className={styles.navBar}>
          <button className={styles.navBtn} onClick={() => navigate('minigame-hub')}>
            <span className={styles.navIcon}>🎮</span> Minigames
          </button>
          <button className={styles.navBtn} onClick={() => navigate('egg-shop')}>
            <span className={styles.navIcon}>🥚</span> Egg Shop
          </button>
          {(hasLovedDragons || hasWildDragons) && (
            <button className={styles.navBtn} onClick={() => navigate('dragon-home')}>
              <span className={styles.navIcon}>🏠</span> Home
            </button>
          )}
        </div>
      </div>

      {pending === 'retire' && (
        <ConfirmDialog
          icon="💖"
          title={`Retire ${dragon.name}?`}
          message="They'll live at home and give you 5 🪙 every day!"
          yesLabel="Retire"
          onNo={() => setPending(null)}
          onYes={() => { setPending(null); retireDragon(); }}
        />
      )}
      {pending === 'release' && (
        <ConfirmDialog
          icon="🌿"
          title={`Set ${dragon.name} free?`}
          message="They'll fly off and come back with prizes!"
          yesLabel="Set free"
          onNo={() => setPending(null)}
          onYes={() => { setPending(null); releaseDragon(); }}
        />
      )}
    </div>
  );
}
