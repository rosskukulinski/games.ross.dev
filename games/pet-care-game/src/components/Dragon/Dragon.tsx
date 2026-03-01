import { ELEMENT_PALETTES } from '../../assets/colors';
import type { DragonElement } from '../../store/gameStoreTypes';
import styles from './Dragon.module.css';

export type Activity = 'idle' | 'walking' | 'playing' | 'sleeping';

interface DragonProps {
  stage: number;
  element: DragonElement;
  mood: 'happy' | 'neutral' | 'sad' | 'hungry' | 'sleepy';
  activity?: Activity;
}

export function Dragon({ stage, element, mood, activity = 'idle' }: DragonProps) {
  const palette = ELEMENT_PALETTES[element];

  if (stage <= 0) return null;

  const activityClass = activity !== 'idle' ? styles[`activity_${activity}`] : '';

  return (
    <div className={`${styles.container} ${styles[`mood_${mood}`]} ${activityClass}`}>
      <svg viewBox="0 0 200 200" className={styles.dragon}>
        {/* Shadow */}
        <ellipse cx="100" cy="180" rx={30 + stage * 6} ry="6" fill="rgba(0,0,0,0.1)" />

        {/* Tail */}
        {stage >= 2 && (
          <path
            d={stage >= 4
              ? "M75 140 Q50 150 35 140 Q20 130 25 120"
              : "M80 135 Q65 140 55 135"
            }
            fill="none"
            stroke={palette.primary}
            strokeWidth={stage >= 3 ? 6 : 4}
            strokeLinecap="round"
          />
        )}
        {/* Tail spade for teen/adult */}
        {stage >= 4 && (
          <path d="M25 120 L18 112 L25 116 L32 112 Z" fill={palette.secondary} />
        )}

        {/* Body */}
        <ellipse
          cx="100"
          cy={stage === 1 ? 145 : 135}
          rx={stage === 1 ? 22 : 18 + stage * 5}
          ry={stage === 1 ? 18 : 14 + stage * 4}
          fill={palette.primary}
        />

        {/* Belly */}
        <ellipse
          cx="100"
          cy={stage === 1 ? 148 : 140}
          rx={stage === 1 ? 14 : 12 + stage * 3}
          ry={stage === 1 ? 12 : 10 + stage * 2}
          fill={palette.secondary}
          opacity="0.6"
        />

        {/* Belly scales for adult */}
        {stage >= 5 && (
          <g opacity="0.3">
            {[0, 1, 2, 3].map(i => (
              <line
                key={i}
                x1={85 + i * 10}
                y1="132"
                x2={85 + i * 10}
                y2="148"
                stroke={palette.primary}
                strokeWidth="1"
              />
            ))}
          </g>
        )}

        {/* Legs */}
        {stage >= 2 && (
          <>
            <ellipse cx={85 - stage} cy="162" rx={4 + stage} ry={3 + stage} fill={palette.primary} />
            <ellipse cx={115 + stage} cy="162" rx={4 + stage} ry={3 + stage} fill={palette.primary} />
          </>
        )}

        {/* Arms (juvenile+) */}
        {stage >= 3 && (
          <>
            <ellipse cx={75 - stage} cy={135} rx={3 + stage} ry={4 + stage} fill={palette.primary} transform={`rotate(-15 ${75 - stage} 135)`} />
            <ellipse cx={125 + stage} cy={135} rx={3 + stage} ry={4 + stage} fill={palette.primary} transform={`rotate(15 ${125 + stage} 135)`} />
          </>
        )}

        {/* Wings */}
        {stage >= 2 && (
          <>
            <path
              d={stage <= 2
                ? "M78 125 Q68 110 72 120"
                : stage === 3
                ? "M75 120 Q55 95 60 115 Q50 100 58 118"
                : stage === 4
                ? "M70 115 Q40 80 50 110 Q30 85 48 112 Q25 90 45 115"
                : "M65 110 Q30 65 45 105 Q15 70 40 108 Q10 80 38 112"
              }
              fill={palette.secondary}
              opacity="0.7"
              stroke={palette.primary}
              strokeWidth="1.5"
            />
            <path
              d={stage <= 2
                ? "M122 125 Q132 110 128 120"
                : stage === 3
                ? "M125 120 Q145 95 140 115 Q150 100 142 118"
                : stage === 4
                ? "M130 115 Q160 80 150 110 Q170 85 152 112 Q175 90 155 115"
                : "M135 110 Q170 65 155 105 Q185 70 160 108 Q190 80 162 112"
              }
              fill={palette.secondary}
              opacity="0.7"
              stroke={palette.primary}
              strokeWidth="1.5"
            />
          </>
        )}

        {/* Neck */}
        {stage >= 3 && (
          <rect
            x="93"
            y={stage >= 4 ? 95 : 105}
            width="14"
            height={stage >= 4 ? 28 : 20}
            rx="7"
            fill={palette.primary}
          />
        )}

        {/* Head */}
        <ellipse
          cx="100"
          cy={stage <= 2 ? 118 : stage === 3 ? 100 : 90}
          rx={stage === 1 ? 18 : 14 + stage * 1.5}
          ry={stage === 1 ? 16 : 12 + stage * 1.5}
          fill={palette.primary}
        />

        {/* Snout */}
        <ellipse
          cx="100"
          cy={stage <= 2 ? 125 : stage === 3 ? 107 : 97}
          rx={stage === 1 ? 8 : 7 + stage}
          ry={stage === 1 ? 6 : 5 + stage * 0.5}
          fill={palette.secondary}
          opacity="0.5"
        />

        {/* Nostrils */}
        <circle cx="95" cy={stage <= 2 ? 124 : stage === 3 ? 106 : 96} r="1.5" fill={palette.primary} opacity="0.6" />
        <circle cx="105" cy={stage <= 2 ? 124 : stage === 3 ? 106 : 96} r="1.5" fill={palette.primary} opacity="0.6" />

        {/* Eyes */}
        <g>
          {(mood === 'sleepy' || activity === 'sleeping') ? (
            <>
              <line x1="88" y1={stage <= 2 ? 115 : stage === 3 ? 97 : 87} x2="96" y2={stage <= 2 ? 115 : stage === 3 ? 97 : 87} stroke="#333" strokeWidth="2" strokeLinecap="round" />
              <line x1="104" y1={stage <= 2 ? 115 : stage === 3 ? 97 : 87} x2="112" y2={stage <= 2 ? 115 : stage === 3 ? 97 : 87} stroke="#333" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : mood === 'happy' ? (
            <>
              <path d={`M88 ${stage <= 2 ? 116 : stage === 3 ? 98 : 88} Q92 ${stage <= 2 ? 112 : stage === 3 ? 94 : 84} 96 ${stage <= 2 ? 116 : stage === 3 ? 98 : 88}`} fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
              <path d={`M104 ${stage <= 2 ? 116 : stage === 3 ? 98 : 88} Q108 ${stage <= 2 ? 112 : stage === 3 ? 94 : 84} 112 ${stage <= 2 ? 116 : stage === 3 ? 98 : 88}`} fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="92" cy={stage <= 2 ? 114 : stage === 3 ? 96 : 86} r={stage === 1 ? 4 : 3.5} fill="white" />
              <circle cx="92" cy={stage <= 2 ? 114 : stage === 3 ? 96 : 86} r={stage === 1 ? 2.5 : 2} fill={palette.eye} />
              <circle cx="108" cy={stage <= 2 ? 114 : stage === 3 ? 96 : 86} r={stage === 1 ? 4 : 3.5} fill="white" />
              <circle cx="108" cy={stage <= 2 ? 114 : stage === 3 ? 96 : 86} r={stage === 1 ? 2.5 : 2} fill={palette.eye} />
              {mood === 'sad' && (
                <>
                  <line x1="88" y1={stage <= 2 ? 109 : stage === 3 ? 91 : 81} x2="95" y2={stage <= 2 ? 111 : stage === 3 ? 93 : 83} stroke="#333" strokeWidth="1.5" />
                  <line x1="112" y1={stage <= 2 ? 109 : stage === 3 ? 91 : 81} x2="105" y2={stage <= 2 ? 111 : stage === 3 ? 93 : 83} stroke="#333" strokeWidth="1.5" />
                </>
              )}
            </>
          )}
        </g>

        {/* Horns (juvenile+) */}
        {stage >= 3 && (
          <>
            <polygon
              points={stage <= 2
                ? ""
                : stage === 3
                ? "87,92 84,82 90,90"
                : stage === 4
                ? "85,82 80,68 90,80"
                : "83,78 76,60 88,76"
              }
              fill={palette.accent}
            />
            <polygon
              points={stage <= 2
                ? ""
                : stage === 3
                ? "113,92 116,82 110,90"
                : stage === 4
                ? "115,82 120,68 110,80"
                : "117,78 124,60 112,76"
              }
              fill={palette.accent}
            />
          </>
        )}

        {/* Crown horns for adult */}
        {stage >= 5 && (
          <polygon points="100,70 96,56 100,62 104,56" fill={palette.accent} />
        )}

        {/* Fire/Ice/Nature/Storm breath for adult */}
        {stage >= 5 && (
          <g className={styles.breathEffect} opacity="0.6">
            {element === 'fire' && (
              <g>
                <circle cx="100" cy="65" r="3" fill="#FF6B35" />
                <circle cx="95" cy="58" r="2" fill="#FFD700" />
                <circle cx="105" cy="60" r="2.5" fill="#FF4500" />
              </g>
            )}
            {element === 'ice' && (
              <g>
                <circle cx="100" cy="65" r="3" fill="#A8DADC" />
                <circle cx="94" cy="58" r="2" fill="#F1FAEE" />
                <circle cx="106" cy="60" r="2.5" fill="#457B9D" />
              </g>
            )}
            {element === 'nature' && (
              <g>
                <circle cx="98" cy="63" r="2.5" fill="#95D5B2" />
                <circle cx="102" cy="58" r="2" fill="#D8F3DC" />
                <circle cx="96" cy="56" r="1.5" fill="#52B788" />
              </g>
            )}
            {element === 'storm' && (
              <g>
                <path d="M97 65 L95 58 L99 61 L98 54" stroke="#9D4EDD" strokeWidth="1.5" fill="none" />
                <path d="M103 63 L105 56 L101 59 L102 52" stroke="#E0AAFF" strokeWidth="1.5" fill="none" />
              </g>
            )}
          </g>
        )}

        {/* Mouth for hungry mood */}
        {mood === 'hungry' && (
          <ellipse
            cx="100"
            cy={stage <= 2 ? 128 : stage === 3 ? 110 : 100}
            rx="4"
            ry="3"
            fill="#333"
          />
        )}
      </svg>

      {/* Zzz particles when sleeping */}
      {activity === 'sleeping' && (
        <div className={styles.zzzContainer}>
          <span className={styles.zzz1}>Z</span>
          <span className={styles.zzz2}>z</span>
          <span className={styles.zzz3}>Z</span>
        </div>
      )}
    </div>
  );
}

export function getMood(stats: { hunger: number; thirst: number; happiness: number; energy: number; health: number }): DragonProps['mood'] {
  if (stats.energy < 15) return 'sleepy';
  if (stats.hunger < 20 || stats.thirst < 20) return 'hungry';
  if (stats.happiness < 25 || stats.health < 25) return 'sad';
  if (stats.happiness > 70) return 'happy';
  return 'neutral';
}
