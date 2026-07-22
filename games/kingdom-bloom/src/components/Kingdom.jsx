import { useState } from 'react';
import { CHAPTERS, TOTAL_SPOTS } from '../game/data.js';

// Pin positions (percent of scene width/height) for each restorable spot.
const POS = {
  gate: { x: 50, y: 48 },
  fountain: { x: 20, y: 82 },
  garden: { x: 86, y: 84 },
  statue: { x: 74, y: 64 },
  lamps: { x: 38, y: 62 },
  bridge: { x: 15, y: 84 },
  bakery: { x: 48, y: 68 },
  market: { x: 76, y: 84 },
  mill: { x: 86, y: 42 },
  cottages: { x: 30, y: 44 },
  stairs: { x: 50, y: 84 },
  tower: { x: 20, y: 46 },
  doors: { x: 50, y: 62 },
  observatory: { x: 81, y: 46 },
  sunstone: { x: 50, y: 24 },
};

/* ---------- Chapter 1: Castle Courtyard ---------- */

function Ch1Scene({ on }) {
  const crenels = [];
  for (let x = 0; x < 800; x += 50) crenels.push(<rect key={x} x={x + 10} y={138} width={26} height={16} fill="#d9cdee" />);
  return (
    <svg viewBox="0 0 800 450" className="scene" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5dcff" /><stop offset="1" stopColor="#e9f9ff" />
        </linearGradient>
        <linearGradient id="grass1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93da7e" /><stop offset="1" stopColor="#5cb85c" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sky1)" />
      <circle cx="88" cy="66" r="32" fill="#ffe28a" />
      <ellipse cx="250" cy="66" rx="48" ry="15" fill="#fff" opacity="0.85" />
      <ellipse cx="610" cy="42" rx="62" ry="17" fill="#fff" opacity="0.8" />

      {/* castle wall + towers */}
      <rect x="0" y="152" width="800" height="148" fill="#e7ddf3" />
      {crenels}
      <rect x="22" y="86" width="92" height="214" fill="#d9cdee" />
      <polygon points="16,88 130,88 73,26" fill="#8f7fd8" />
      <rect x="686" y="86" width="92" height="214" fill="#d9cdee" />
      <polygon points="680,88 794,88 737,26" fill="#8f7fd8" />
      <rect x="58" y="130" width="20" height="30" rx="9" fill="#6f5fb0" />
      <rect x="722" y="130" width="20" height="30" rx="9" fill="#6f5fb0" />
      <rect x="160" y="190" width="18" height="26" rx="8" fill="#c3b3e2" />
      <rect x="620" y="190" width="18" height="26" rx="8" fill="#c3b3e2" />

      {/* gate */}
      <path d="M332 300 v-92 a68 68 0 0 1 136 0 v92 z" fill="#b9a7d9" />
      {on('gate') ? (
        <g className="pop">
          <path d="M344 300 v-84 a56 56 0 0 1 112 0 v84 z" fill="#a06a3a" />
          <line x1="400" y1="162" x2="400" y2="300" stroke="#7c4f27" strokeWidth="4" />
          <path d="M344 300 v-84 a56 56 0 0 1 112 0 v84" fill="none" stroke="#f6c453" strokeWidth="7" />
          <circle cx="386" cy="240" r="5" fill="#f6c453" />
          <circle cx="414" cy="240" r="5" fill="#f6c453" />
          <polygon points="300,150 300,204 330,177" fill="#ff5d73" />
          <polygon points="500,150 500,204 470,177" fill="#ff5d73" />
        </g>
      ) : (
        <g>
          <path d="M344 300 v-84 a56 56 0 0 1 112 0 v84 z" fill="#42395c" />
          <polygon points="352,300 380,214 398,224 372,300" fill="#7a6a52" />
          <polygon points="452,300 424,240 410,262 434,300" fill="#6d5e49" />
          <path d="M360 200 l16 22 M448 210 l-14 20" stroke="#2c2542" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* ground */}
      <rect x="0" y="296" width="800" height="154" fill="url(#grass1)" />
      <path d="M340 300 L300 450 L500 450 L460 300 Z" fill="#e8d9b5" />
      <ellipse cx="380" cy="360" rx="14" ry="6" fill="#d9c69a" />
      <ellipse cx="420" cy="400" rx="16" ry="7" fill="#d9c69a" />

      {/* fountain */}
      {on('fountain') ? (
        <g className="pop">
          <ellipse cx="160" cy="368" rx="66" ry="20" fill="#9fb8cc" />
          <ellipse cx="160" cy="362" rx="54" ry="15" fill="#63c3f0" />
          <rect x="150" y="312" width="20" height="46" rx="8" fill="#b7c9d9" />
          <ellipse cx="160" cy="314" rx="26" ry="8" fill="#63c3f0" />
          <path d="M160 302 q-24 26 -34 52 M160 302 q24 26 34 52" fill="none" stroke="#8fdcff" strokeWidth="5" strokeLinecap="round" />
          <circle cx="126" cy="330" r="4" fill="#bdeaff" />
          <circle cx="196" cy="334" r="4" fill="#bdeaff" />
        </g>
      ) : (
        <g>
          <ellipse cx="160" cy="368" rx="66" ry="20" fill="#9aa3ab" />
          <ellipse cx="160" cy="362" rx="54" ry="15" fill="#7d868e" />
          <rect x="150" y="316" width="20" height="42" rx="8" fill="#9aa3ab" transform="rotate(-8 160 340)" />
          <path d="M116 362 l24 -14 M186 370 l20 -10" stroke="#5f676e" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* lamps */}
      {[268, 532].map((x) => (
        <g key={x}>
          <rect x={x - 4} y={250} width={8} height={70} rx={3} fill="#5d5670" />
          <rect x={x - 12} y={236} width={24} height={22} rx={7} fill={on('lamps') ? '#ffd75e' : '#3f3a52'} />
          {on('lamps') && <circle className="glowfx" cx={x} cy={247} r={26} fill="#ffe28a" opacity="0.45" />}
        </g>
      ))}

      {/* statue */}
      {on('statue') ? (
        <g className="pop">
          <rect x="536" y="330" width="68" height="26" rx="6" fill="#cfc4e6" />
          <rect x="548" y="306" width="44" height="28" rx="6" fill="#e2d9f2" />
          <circle cx="570" cy="272" r="17" fill="#ffd166" />
          <polygon points="558,262 552,244 566,254" fill="#ffd166" />
          <polygon points="582,262 588,244 574,254" fill="#ffd166" />
          <path d="M554 306 q16 -26 32 0" fill="#ffd166" />
          <circle cx="565" cy="270" r="2.5" fill="#7a5a1e" />
          <circle cx="575" cy="270" r="2.5" fill="#7a5a1e" />
        </g>
      ) : (
        <g>
          <rect x="536" y="330" width="68" height="26" rx="6" fill="#a7a0b8" />
          <polygon points="552,332 566,268 592,280 584,332" fill="#8d8699" transform="rotate(7 570 300)" />
          <path d="M560 290 l18 10" stroke="#6e687e" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* garden */}
      {on('garden') ? (
        <g className="pop">
          <ellipse cx="690" cy="392" rx="86" ry="26" fill="#7ccb66" />
          {[[640, 384, '#ff6b9d'], [672, 396, '#ffd166'], [706, 382, '#c77dff'], [738, 394, '#ff8f5e'], [700, 406, '#ff6b9d'], [660, 408, '#ffd166']].map(([x, y, c], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x} y2={y - 14} stroke="#3e8e41" strokeWidth="3" />
              <circle cx={x} cy={y - 18} r="7" fill={c} />
              <circle cx={x} cy={y - 18} r="2.6" fill="#fff7d6" />
            </g>
          ))}
        </g>
      ) : (
        <g>
          <ellipse cx="690" cy="392" rx="86" ry="26" fill="#b0946a" />
          <path d="M640 386 q6 -18 2 -26 M676 398 q-8 -16 -2 -30 M718 386 q8 -14 4 -26 M744 398 q-6 -16 0 -26" fill="none" stroke="#7c9a55" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/* ---------- Chapter 2: Village Row ---------- */

function Ch2Scene({ on }) {
  return (
    <svg viewBox="0 0 800 450" className="scene" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9b8" /><stop offset="1" stopColor="#c9f0ff" />
        </linearGradient>
        <linearGradient id="grass2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3dd8a" /><stop offset="1" stopColor="#63bd63" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sky2)" />
      <circle cx="700" cy="70" r="34" fill="#ffd97a" />
      <ellipse cx="180" cy="60" rx="52" ry="16" fill="#fff" opacity="0.85" />

      {/* hills */}
      <ellipse cx="180" cy="330" rx="360" ry="140" fill="#8fd379" />
      <ellipse cx="650" cy="340" rx="380" ry="160" fill="url(#grass2)" />

      {/* cottages (background row) */}
      {[[250, 150], [400, 132], [560, 150]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y + 40} width="86" height="60" rx="4" fill="#fdf3dd" stroke="#e0cfa8" strokeWidth="2" />
          <rect x={x + 32} y={y + 72} width="22" height="28" rx="3" fill="#a06a3a" />
          <rect x={x + 10} y={y + 52} width="18" height="16" rx="3" fill={on('cottages') ? '#ffd75e' : '#8b8b9e'} />
          <rect x={x + 58} y={y + 52} width="18" height="16" rx="3" fill={on('cottages') ? '#ffd75e' : '#8b8b9e'} />
          {on('cottages') ? (
            <g className="pop">
              <polygon points={`${x - 8},${y + 42} ${x + 94},${y + 42} ${x + 43},${y}`} fill="#e2574c" />
              <rect x={x + 62} y={y + 6} width="12" height="26" fill="#b8433a" />
              <circle className="glowfx" cx={x + 68} cy={y - 6} r="7" fill="#fff" opacity="0.7" />
              <circle className="glowfx" cx={x + 76} cy={y - 18} r="5" fill="#fff" opacity="0.5" />
            </g>
          ) : (
            <g>
              <polygon points={`${x - 8},${y + 42} ${x + 94},${y + 42} ${x + 43},${y}`} fill="#7e7a8c" />
              <polygon points={`${x + 26},${y + 20} ${x + 52},${y + 20} ${x + 40},${y + 40}`} fill="#4c4859" />
            </g>
          )}
        </g>
      ))}

      {/* stream + bridge */}
      <path d="M0 360 Q 120 340 170 380 T 340 450 L 0 450 Z" fill="#6fc8ef" />
      {on('bridge') ? (
        <g className="pop">
          <path d="M60 384 q60 -52 120 0" fill="none" stroke="#a06a3a" strokeWidth="16" strokeLinecap="round" />
          <path d="M60 368 q60 -52 120 0" fill="none" stroke="#c98a4b" strokeWidth="8" strokeLinecap="round" />
          <line x1="86" y1="352" x2="86" y2="376" stroke="#7c4f27" strokeWidth="5" />
          <line x1="120" y1="344" x2="120" y2="366" stroke="#7c4f27" strokeWidth="5" />
          <line x1="154" y1="352" x2="154" y2="376" stroke="#7c4f27" strokeWidth="5" />
        </g>
      ) : (
        <g>
          <rect x="52" y="376" width="36" height="16" rx="4" fill="#8a8a97" />
          <rect x="152" y="376" width="36" height="16" rx="4" fill="#8a8a97" />
          <polygon points="96,392 148,380 152,392 100,404" fill="#7a6a52" />
        </g>
      )}

      {/* bakery (foreground center) */}
      <g>
        <rect x="330" y="240" width="150" height="110" rx="8" fill="#ffe8f0" stroke="#e7b9cd" strokeWidth="3" />
        <polygon points="318,244 492,244 405,186" fill={on('bakery') ? '#e2574c' : '#7e7a8c'} />
        <rect x="384" y="296" width="42" height="54" rx="4" fill="#a06a3a" />
        {on('bakery') ? (
          <g className="pop">
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M${338 + i * 28} 262 a14 14 0 0 1 28 0 v10 h-28 z`} fill={i % 2 ? '#fff' : '#ff8fb0'} />
            ))}
            <rect x="342" y="300" width="30" height="24" rx="4" fill="#ffd75e" />
            <rect x="438" y="300" width="30" height="24" rx="4" fill="#ffd75e" />
            <circle cx="405" cy="222" r="13" fill="#ffd166" stroke="#c98a4b" strokeWidth="3" />
            <path d="M398 222 q7 -8 14 0 q-7 8 -14 0" fill="#c98a4b" />
          </g>
        ) : (
          <g>
            <rect x="342" y="300" width="30" height="24" rx="4" fill="#6f6b7d" />
            <rect x="438" y="300" width="30" height="24" rx="4" fill="#6f6b7d" />
            <line x1="342" y1="300" x2="372" y2="324" stroke="#4c4859" strokeWidth="4" />
            <line x1="372" y1="300" x2="342" y2="324" stroke="#4c4859" strokeWidth="4" />
            <line x1="330" y1="270" x2="480" y2="262" stroke="#8a8a97" strokeWidth="6" />
          </g>
        )}
      </g>

      {/* market stalls */}
      {on('market') ? (
        <g className="pop">
          {[[540, '#ff6b6b'], [640, '#4ecdc4']].map(([x, c], i) => (
            <g key={i}>
              <rect x={x} y={352} width="80" height="34" rx="4" fill="#e8d5ae" />
              <rect x={x - 6} y={330} width="92" height="14" rx="6" fill={c} />
              {[0, 1, 2, 3].map((s) => (
                <rect key={s} x={x - 6 + s * 23} y={330} width="12" height="14" fill="#fff" opacity="0.85" />
              ))}
              <circle cx={x + 20} cy={352} r="7" fill="#ffd166" />
              <circle cx={x + 40} cy={350} r="7" fill="#ff8f5e" />
              <circle cx={x + 60} cy={352} r="7" fill="#c77dff" />
            </g>
          ))}
        </g>
      ) : (
        <g>
          <polygon points="540,386 620,378 616,392 544,398" fill="#8f7f63" />
          <rect x="632" y="360" width="12" height="30" fill="#8f7f63" transform="rotate(16 638 375)" />
          <rect x="668" y="356" width="12" height="34" fill="#7a6a52" transform="rotate(-12 674 373)" />
          <path d="M560 372 l30 -8" stroke="#6d5e49" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {/* windmill */}
      <g>
        <polygon points="660,240 740,240 726,120 674,120" fill="#f3e6c9" stroke="#d8c49c" strokeWidth="3" />
        <rect x="688" y="204" width="24" height="36" rx="4" fill="#a06a3a" />
        {on('mill') ? (
          <g className="pop">
            <polygon points="662,122 738,122 700,84" fill="#e2574c" />
            <g className="spin" style={{ transformOrigin: '700px 140px' }}>
              {[0, 90, 180, 270].map((a) => (
                <g key={a} transform={`rotate(${a} 700 140)`}>
                  <rect x="696" y="60" width="8" height="80" rx="4" fill="#8a5a33" />
                  <rect x="688" y="62" width="24" height="52" rx="6" fill="#fff" stroke="#d8c49c" strokeWidth="2" />
                </g>
              ))}
              <circle cx="700" cy="140" r="10" fill="#5d4324" />
            </g>
          </g>
        ) : (
          <g>
            <polygon points="662,122 738,122 700,84" fill="#7e7a8c" />
            <rect x="696" y="70" width="8" height="70" rx="4" fill="#6d5e49" transform="rotate(24 700 140)" />
            <rect x="696" y="140" width="8" height="66" rx="4" fill="#6d5e49" transform="rotate(-38 700 140)" />
            <circle cx="700" cy="140" r="9" fill="#4c4859" />
          </g>
        )}
      </g>
    </svg>
  );
}

/* ---------- Chapter 3: Sunstone Keep ---------- */

function Ch3Scene({ on }) {
  const lit = on('sunstone');
  return (
    <svg viewBox="0 0 800 450" className="scene" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? '#ffd98a' : '#5d5490'} />
          <stop offset="1" stopColor={lit ? '#ffeecb' : '#a893c9'} />
        </linearGradient>
        <linearGradient id="stone3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe6f8" /><stop offset="1" stopColor="#cbbde4" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sky3)" />
      {!lit && [[90, 60], [200, 110], [620, 60], [720, 130], [420, 40], [320, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#fff" opacity="0.85" />
      ))}
      {lit && <circle className="glowfx" cx="400" cy="90" r="130" fill="#ffde7a" opacity="0.35" />}

      {/* keep body */}
      <ellipse cx="400" cy="400" rx="420" ry="90" fill="#7cb069" />
      <rect x="300" y="170" width="200" height="200" fill="url(#stone3)" />
      <rect x="330" y="120" width="140" height="60" fill="#d9cdee" />
      <polygon points="322,122 478,122 400,58" fill="#8f7fd8" />

      {/* sunstone */}
      {lit ? (
        <g className="pop">
          <g className="pulse" style={{ transformOrigin: '400px 88px' }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <polygon key={a} points="396,40 404,40 400,16" fill="#ffd75e" transform={`rotate(${a} 400 88)`} />
            ))}
            <circle cx="400" cy="88" r="26" fill="#ffde7a" stroke="#f6b73c" strokeWidth="4" />
            <circle cx="400" cy="88" r="12" fill="#fff3c4" />
          </g>
        </g>
      ) : (
        <g>
          <polygon points="400,64 420,88 400,112 380,88" fill="#4c4566" stroke="#37324e" strokeWidth="3" />
          <path d="M392 76 l10 14 l-6 12" fill="none" stroke="#2b273d" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {/* watch tower (left) */}
      <g>
        <rect x="130" y="180" width="76" height="190" fill="url(#stone3)" />
        <polygon points="122,182 214,182 168,120" fill="#8f7fd8" />
        <rect x="156" y="220" width="22" height="30" rx="9" fill="#6f5fb0" />
        {on('tower') ? (
          <g className="pop">
            <line x1="168" y1="120" x2="168" y2="70" stroke="#7c4f27" strokeWidth="5" />
            <polygon points="168,70 168,96 216,83" fill="#4ecdc4" className="wave" />
          </g>
        ) : (
          <path d="M144 240 l18 34 M188 210 l-12 30" stroke="#8b7fae" strokeWidth="4" strokeLinecap="round" />
        )}
      </g>

      {/* observatory (right) */}
      <g>
        <rect x="580" y="230" width="110" height="140" fill="url(#stone3)" />
        {on('observatory') ? (
          <g className="pop">
            <path d="M574 232 a61 61 0 0 1 122 0 z" fill="#5e60ce" />
            <rect x="626" y="168" width="18" height="46" rx="4" fill="#3f3f8f" transform="rotate(30 635 200)" />
            <circle cx="652" cy="176" r="6" fill="#ffd75e" />
            <rect x="596" y="270" width="20" height="24" rx="4" fill="#ffd75e" />
            <rect x="654" y="270" width="20" height="24" rx="4" fill="#ffd75e" />
          </g>
        ) : (
          <g>
            <path d="M574 232 a61 61 0 0 1 122 0 z" fill="#6f6b7d" />
            <path d="M600 200 l24 20 M668 196 l-20 22" stroke="#57536a" strokeWidth="4" strokeLinecap="round" />
            <rect x="596" y="270" width="20" height="24" rx="4" fill="#57536a" />
            <rect x="654" y="270" width="20" height="24" rx="4" fill="#57536a" />
          </g>
        )}
      </g>

      {/* great doors */}
      <path d="M356 370 v-64 a44 44 0 0 1 88 0 v64 z" fill="#b9a7d9" />
      {on('doors') ? (
        <g className="pop">
          <path d="M364 370 v-58 a36 36 0 0 1 72 0 v58 z" fill="#f6c453" />
          <line x1="400" y1="276" x2="400" y2="370" stroke="#c9962e" strokeWidth="4" />
          <circle cx="388" cy="326" r="5" fill="#8a5a33" />
          <circle cx="412" cy="326" r="5" fill="#8a5a33" />
          <path d="M372 300 q28 -18 56 0" fill="none" stroke="#c9962e" strokeWidth="3" />
        </g>
      ) : (
        <g>
          <path d="M364 370 v-58 a36 36 0 0 1 72 0 v58 z" fill="#37324e" />
          <polygon points="372,370 396,300 410,316 388,370" fill="#5a4a36" />
          <path d="M424 320 l-10 24" stroke="#241f36" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* grand stairs */}
      {on('stairs') ? (
        <g className="pop">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={340 - i * 22} y={372 + i * 16} width={120 + i * 44} height={16} rx={5} fill={i % 2 ? '#e2d9f2' : '#cfc4e6'} />
          ))}
        </g>
      ) : (
        <g>
          <polygon points="330,380 470,380 500,436 300,436" fill="#8d8699" />
          <ellipse cx="360" cy="408" rx="18" ry="10" fill="#6f6b7d" />
          <ellipse cx="430" cy="418" rx="22" ry="11" fill="#6f6b7d" />
          <ellipse cx="392" cy="392" rx="12" ry="7" fill="#57536a" />
        </g>
      )}
    </svg>
  );
}

const SCENES = { courtyard: Ch1Scene, village: Ch2Scene, keep: Ch3Scene };

/* ---------- Kingdom view ---------- */

export default function Kingdom({ restored, stars, dispatch }) {
  const restoredSet = new Set(restored);
  const on = (id) => restoredSet.has(id);

  const isChapterUnlocked = (idx) =>
    idx === 0 || CHAPTERS[idx - 1].spots.every((s) => restoredSet.has(s.id));

  const currentIdx = (() => {
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (!CHAPTERS[i].spots.every((s) => restoredSet.has(s.id))) return isChapterUnlocked(i) ? i : Math.max(0, i - 1);
    }
    return CHAPTERS.length - 1;
  })();

  const [tab, setTab] = useState(currentIdx);
  const chapter = CHAPTERS[tab];
  const unlocked = isChapterUnlocked(tab);
  const Scene = SCENES[chapter.id];

  return (
    <div className="kingdom">
      <div className="chapter-tabs">
        {CHAPTERS.map((ch, i) => {
          const open = isChapterUnlocked(i);
          return (
            <button
              key={ch.id}
              className={`chapter-tab${tab === i ? ' active' : ''}${open ? '' : ' locked'}`}
              onClick={() => setTab(i)}
            >
              {open ? ch.emoji : '🔒'} {ch.name}
            </button>
          );
        })}
      </div>

      <div className="scene-wrap">
        <Scene on={on} />
        {!unlocked && (
          <div className="scene-lock">
            <span>🔒</span>
            <p>Restore all of {CHAPTERS[tab - 1].name} to unlock!</p>
          </div>
        )}
        {unlocked && chapter.spots.map((spot) => {
          if (restoredSet.has(spot.id)) return null;
          const pos = POS[spot.id];
          const affordable = stars >= spot.cost;
          return (
            <button
              key={spot.id}
              className={`pin${affordable ? ' affordable' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => dispatch({ type: 'RESTORE', spotId: spot.id })}
            >
              <span className="pin-name">{spot.name}</span>
              <span className="pin-cost">⭐ {spot.cost}</span>
            </button>
          );
        })}
      </div>

      <div className="kingdom-progress">
        🌟 {restored.length}/{TOTAL_SPOTS} places restored
        {restored.length === TOTAL_SPOTS && ' — Bloomvale shines again!'}
      </div>
    </div>
  );
}
