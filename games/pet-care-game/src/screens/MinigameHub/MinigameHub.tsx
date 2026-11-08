import { useGameStore } from '../../store/useGameStore';
import { CurrencyDisplay } from '../../components/CurrencyDisplay/CurrencyDisplay';
import styles from './MinigameHub.module.css';
import type { Screen } from '../../store/gameStoreTypes';

interface MinigameInfo {
  screen: Screen;
  icon: string;
  name: string;
  description: string;
  reward: string;
  color: string;
}

const MINIGAMES: MinigameInfo[] = [
  {
    screen: 'minigame-park',
    icon: '🌳',
    name: 'Clean the Park',
    description: 'Tap the trash!',
    reward: '20-40',
    color: '#2d6a4f',
  },
  {
    screen: 'minigame-jobs',
    icon: '📦',
    name: 'Helping Jobs',
    description: 'Pack the box!',
    reward: '25-50',
    color: '#e76f51',
  },
  {
    screen: 'minigame-cage',
    icon: '🧹',
    name: 'Clean the Cage',
    description: 'Scrub the dirt!',
    reward: '20-45 🫧',
    color: '#457b9d',
  },
  {
    screen: 'minigame-racing',
    icon: '🏁',
    name: 'Dragon Racing',
    description: 'Tap fast to run!',
    reward: '20-50',
    color: '#f59e0b',
  },
  {
    screen: 'minigame-treasure',
    icon: '💎',
    name: 'Treasure Hunt',
    description: 'Find the pairs!',
    reward: '15-40',
    color: '#4c1d95',
  },
  {
    screen: 'minigame-cooking',
    icon: '🍳',
    name: 'Dragon Cooking',
    description: 'Tap the food in order!',
    reward: '20-45',
    color: '#c2410c',
  },
];

export function MinigameHub() {
  const navigate = useGameStore(s => s.navigate);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>Minigames</h2>
        <CurrencyDisplay />
      </div>

      <p className={styles.subtitle}>🪙 Play to earn coins!</p>

      <div className={styles.list}>
        {MINIGAMES.map(game => (
          <button
            key={game.screen}
            className={styles.card}
            style={{ borderColor: game.color }}
            onClick={() => navigate(game.screen)}
          >
            <span className={styles.gameIcon}>{game.icon}</span>
            <div className={styles.gameInfo}>
              <h3 className={styles.gameName} style={{ color: game.color }}>{game.name}</h3>
              <p className={styles.gameDesc}>{game.description}</p>
              <span className={styles.reward}>🪙 {game.reward}</span>
            </div>
            <span className={styles.playArrow}>▶</span>
          </button>
        ))}
      </div>

      <button className={styles.backBtn} onClick={() => navigate('main-care')}>
        ⬅ Back to Dragon
      </button>
    </div>
  );
}
