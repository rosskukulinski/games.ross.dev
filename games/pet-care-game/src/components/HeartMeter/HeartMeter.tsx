import { useGameStore } from '../../store/useGameStore';
import styles from './HeartMeter.module.css';

export function HeartMeter() {
  const love = useGameStore(s => s.dragon?.love ?? 0);
  const isFull = love >= 100;
  const isPulsing = love >= 90;

  return (
    <div className={`${styles.container} ${isPulsing ? styles.pulsing : ''} ${isFull ? styles.full : ''}`}>
      <svg viewBox="0 0 60 60" className={styles.heart}>
        <defs>
          <clipPath id="heart-clip">
            <path d="M30 52 C15 40 2 30 2 18 C2 8 10 2 18 2 C23 2 27 5 30 10 C33 5 37 2 42 2 C50 2 58 8 58 18 C58 30 45 40 30 52Z" />
          </clipPath>
        </defs>
        {/* Outline */}
        <path
          d="M30 52 C15 40 2 30 2 18 C2 8 10 2 18 2 C23 2 27 5 30 10 C33 5 37 2 42 2 C50 2 58 8 58 18 C58 30 45 40 30 52Z"
          fill="none"
          stroke={isFull ? '#FFD700' : '#e0507a'}
          strokeWidth="2"
        />
        {/* Empty fill */}
        <path
          d="M30 52 C15 40 2 30 2 18 C2 8 10 2 18 2 C23 2 27 5 30 10 C33 5 37 2 42 2 C50 2 58 8 58 18 C58 30 45 40 30 52Z"
          fill="#f0d0d8"
          opacity="0.3"
        />
        {/* Fill level */}
        <rect
          x="0"
          y={55 - (love / 100) * 53}
          width="60"
          height={(love / 100) * 53 + 2}
          fill={isFull ? '#FFD700' : '#e0507a'}
          clipPath="url(#heart-clip)"
        />
      </svg>
      <span className={styles.value}>{Math.floor(love)}</span>
    </div>
  );
}
