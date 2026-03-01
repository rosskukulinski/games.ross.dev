import { ELEMENT_PALETTES } from '../../assets/colors';
import type { DragonElement } from '../../store/gameStoreTypes';
import styles from './Egg.module.css';

interface EggProps {
  element: DragonElement;
  cracking?: boolean;
  size?: number;
}

export function Egg({ element, cracking, size = 200 }: EggProps) {
  const palette = ELEMENT_PALETTES[element];

  return (
    <div className={`${styles.container} ${cracking ? styles.cracking : styles.wobble}`}>
      <svg viewBox="0 0 120 160" width={size} height={size * 1.33}>
        {/* Main egg shape */}
        <ellipse cx="60" cy="85" rx="42" ry="55" fill={palette.secondary} />
        <ellipse cx="60" cy="85" rx="42" ry="55" fill={`url(#eggGrad-${element})`} />

        {/* Element spots */}
        <circle cx="45" cy="65" r="8" fill={palette.primary} opacity="0.4" />
        <circle cx="75" cy="80" r="6" fill={palette.primary} opacity="0.3" />
        <circle cx="55" cy="100" r="7" fill={palette.primary} opacity="0.35" />
        <circle cx="70" cy="60" r="5" fill={palette.accent} opacity="0.3" />

        {/* Shine */}
        <ellipse cx="48" cy="65" rx="8" ry="12" fill="white" opacity="0.15" transform="rotate(-15 48 65)" />

        {/* Crack lines when hatching */}
        {cracking && (
          <g className={styles.cracks}>
            <path d="M45 75 L55 68 L50 80 L60 72" stroke="#333" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M65 85 L70 78 L68 90" stroke="#333" strokeWidth="1.5" fill="none" opacity="0.6" />
          </g>
        )}

        <defs>
          <radialGradient id={`eggGrad-${element}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor={palette.primary} stopOpacity="0.2" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
