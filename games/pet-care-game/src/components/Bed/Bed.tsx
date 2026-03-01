import { ELEMENT_PALETTES } from '../../assets/colors';
import type { DragonElement } from '../../store/gameStoreTypes';
import styles from './Bed.module.css';

interface BedProps {
  element: DragonElement;
  isSleeping: boolean;
  onClick: () => void;
}

export function Bed({ element, isSleeping, onClick }: BedProps) {
  const palette = ELEMENT_PALETTES[element];

  return (
    <button className={`${styles.bed} ${isSleeping ? styles.active : ''}`} onClick={onClick}>
      <svg viewBox="0 0 100 60" className={styles.bedSvg}>
        {/* Bed frame */}
        <rect x="5" y="30" width="90" height="25" rx="4" fill="#8B6B4A" />
        {/* Mattress */}
        <rect x="8" y="22" width="84" height="14" rx="3" fill="#F5E6D3" />
        {/* Blanket */}
        <rect x="25" y="18" width="67" height="20" rx="4" fill={palette.primary} opacity="0.7" />
        {/* Pillow */}
        <ellipse cx="18" cy="22" rx="12" ry="8" fill="#fff" opacity="0.9" />
        {/* Headboard */}
        <rect x="3" y="10" width="8" height="38" rx="3" fill="#6B4E3D" />
        {/* Footboard */}
        <rect x="89" y="20" width="6" height="28" rx="2" fill="#6B4E3D" />
        {/* Legs */}
        <rect x="8" y="52" width="5" height="6" rx="1" fill="#6B4E3D" />
        <rect x="87" y="52" width="5" height="6" rx="1" fill="#6B4E3D" />
      </svg>
      {isSleeping && (
        <div className={styles.zzzBed}>
          <span>z</span><span>Z</span><span>z</span>
        </div>
      )}
      {!isSleeping && <span className={styles.label}>Sleep</span>}
    </button>
  );
}
