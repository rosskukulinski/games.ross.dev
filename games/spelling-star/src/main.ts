import './style.css';
import { Sky, COLORS } from './sky';
import { sfx } from './audio';
import { speak, stopSpeaking, speechAvailable, listVoices, getVoiceSettings, setVoiceSettings, onVoicesChanged, type Speed } from './speech';
import { DEFAULT_LIST, loadList, saveList, parseList, listKey, type WordEntry, type WordList } from './words';

type Mode = 'listen' | 'scramble' | 'gaps';
type Screen = 'title' | 'play' | 'results' | 'editor';

const MODES: Record<Mode, { name: string; blurb: string; icon: string; color: string }> = {
  listen: { name: 'Listen & Spell', blurb: 'Hear it, spell it — just like the real test!', icon: '🎧', color: 'gold' },
  scramble: { name: 'Unscramble', blurb: 'Put the jumbled letters back in order', icon: '🔀', color: 'pink' },
  gaps: { name: 'Fill the Gaps', blurb: 'Find the letters that went missing', icon: '🧩', color: 'teal' },
};
const QWERTY = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const DECOYS = 'aeioulrstnmdpbchgy';
const BONUS_KEY = 'spelling-star-bonus';

interface Tile {
  letter: string;
  used: boolean;
  el: HTMLButtonElement;
}

interface Turn {
  entry: WordEntry;
  slots: (string | null)[];
  kind: ('empty' | 'given' | 'typed' | 'hint')[];
  slotEls: HTMLElement[];
  tiles: Tile[];
  keys: Map<string, HTMLButtonElement>;
  mistakes: number;
  hints: number;
  peeked: boolean;
  slotMisses: number;
  done: boolean;
}

interface Round {
  mode: Mode;
  entries: WordEntry[];
  queue: WordEntry[];
  retried: Set<string>;
  best: Map<string, number>;
  first: Map<string, number>;
  score: number;
  streak: number;
  bestStreak: number;
  played: number;
}

// ---------------------------------------------------------------- setup

const app = document.getElementById('app')!;
const sky = new Sky(document.getElementById('sky') as HTMLCanvasElement);
sky.onShake = (x, y) => {
  app.style.transform = x || y ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` : '';
};

let list: WordList = loadList();
let includeBonus = localStorage.getItem(BONUS_KEY) === '1';
let screen: Screen = 'title';
let round: Round | null = null;
let turn: Turn | null = null;
let displayScore = 0;
let advanceTimer = 0;

const corner = el(`<div class="corner">
  <button class="icon-btn" id="btn-home" aria-label="Menu" hidden>☰</button>
  <button class="icon-btn" id="btn-mute" aria-label="Sound"></button>
</div>`);
document.body.appendChild(corner);
const muteBtn = corner.querySelector<HTMLButtonElement>('#btn-mute')!;
const homeBtn = corner.querySelector<HTMLButtonElement>('#btn-home')!;
function paintMute(): void {
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
}
paintMute();
muteBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  paintMute();
  sfx.tap();
});
homeBtn.addEventListener('click', () => {
  sfx.tap();
  showTitle();
});

window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
window.addEventListener('keydown', () => sfx.unlock(), { capture: true });

document.addEventListener('visibilitychange', () => {
  const hidden = document.visibilityState === 'hidden';
  sky.setRunning(!hidden);
  if (hidden) stopSpeaking();
});

window.addEventListener('resize', () => sizeBoard());

// ---------------------------------------------------------------- helpers

function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function center(e: Element): { x: number; y: number } {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function restart(e: HTMLElement, cls: string): void {
  e.classList.remove(cls);
  void e.offsetWidth;
  e.classList.add(cls);
}

function words(): { main: WordEntry[]; bonus: WordEntry[] } {
  return parseList(list);
}

function roundEntries(): WordEntry[] {
  const { main, bonus } = words();
  return includeBonus ? [...main, ...bonus] : main;
}

interface Best {
  score: number;
  stars: number;
  of: number;
}
function bestKey(mode: Mode): string {
  return `spelling-star-best-${listKey(list)}-${includeBonus ? 'b' : 'm'}-${mode}`;
}
function loadBest(mode: Mode): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(mode));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

function sayWord(entry: WordEntry, withSentence: boolean): void {
  // Sentences read a little quicker than the lone word, like a teacher does.
  speak(withSentence && entry.sentence ? [entry.word, [entry.sentence, 1.3], entry.word] : [entry.word]);
}

const STAR_SVG = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0-11 3.2-3.6 11-3.4 4.9 1.6 7 9.3 0 5 -7 9.3-4.9 1.6-11-3.4-3.2-3.6Z"/></svg>`;

function setScreen(s: Screen, node: HTMLElement): void {
  screen = s;
  window.clearTimeout(advanceTimer);
  app.replaceChildren(node);
  homeBtn.hidden = s === 'title';
  document.body.dataset.screen = s;
}

// ---------------------------------------------------------------- title

function showTitle(): void {
  stopSpeaking();
  round = null;
  turn = null;
  sky.energy = 0;
  sky.clearFlyers();
  const { main, bonus } = words();
  const count = includeBonus ? main.length + bonus.length : main.length;

  const node = el(`<div class="screen title-screen">
    <div class="logo">
      <div class="logo-star">${STAR_SVG}</div>
      <h1><span>Spelling</span> <span>Star</span></h1>
      <p class="list-name">${esc(list.title)} · ${count} words</p>
    </div>
    <div class="modes"></div>
    <div class="word-board">
      <div class="chips"></div>
      <div class="board-foot">
        ${bonus.length ? `<label class="toggle"><input type="checkbox" id="bonus" ${includeBonus ? 'checked' : ''}/><span class="knob"></span> Bonus words (+${bonus.length})</label>` : '<span></span>'}
        <button class="link-btn" id="edit">✏️ Grown-ups: change words</button>
      </div>
      ${speechAvailable ? '<p class="tip">Tap a word to hear it</p>' : '<p class="tip warn">This browser cannot read words aloud — use Peek to see each word.</p>'}
    </div>
  </div>`);

  const modes = node.querySelector('.modes')!;
  (Object.keys(MODES) as Mode[]).forEach((m, i) => {
    const info = MODES[m];
    const best = loadBest(m);
    const card = el<HTMLButtonElement>(`<button class="mode-card c-${info.color}" style="animation-delay:${0.15 + i * 0.09}s" data-mode="${m}">
      <span class="mode-icon">${info.icon}</span>
      <span class="mode-name">${info.name}</span>
      <span class="mode-blurb">${info.blurb}</span>
      <span class="mode-best">${best ? `★ ${best.stars}/${best.of} · best ${best.score.toLocaleString()}` : 'Not played yet'}</span>
    </button>`);
    card.addEventListener('click', () => {
      if (!count) return;
      sfx.tap();
      startRound(m, roundEntries());
    });
    modes.appendChild(card);
  });

  const chips = node.querySelector('.chips')!;
  const all = includeBonus ? [...main, ...bonus] : main;
  if (!all.length) chips.appendChild(el(`<p class="empty">No words yet — tap “change words” to add this week’s list.</p>`));
  all.forEach((e, i) => {
    const chip = el<HTMLButtonElement>(`<button class="chip${e.bonus ? ' bonus' : ''}" style="animation-delay:${0.35 + i * 0.03}s">${esc(e.word)}</button>`);
    chip.addEventListener('click', () => {
      sfx.tap();
      sayWord(e, true);
      restart(chip, 'ping');
      const c = center(chip);
      sky.fizz(c.x, c.y, e.bonus ? COLORS.pink : COLORS.gold, 8);
    });
    chips.appendChild(chip);
  });

  node.querySelector<HTMLInputElement>('#bonus')?.addEventListener('change', (ev) => {
    includeBonus = (ev.target as HTMLInputElement).checked;
    localStorage.setItem(BONUS_KEY, includeBonus ? '1' : '0');
    sfx.tap();
    showTitle();
  });
  node.querySelector('#edit')!.addEventListener('click', () => {
    sfx.tap();
    showEditor();
  });

  setScreen('title', node);
}

// ---------------------------------------------------------------- editor

function showEditor(): void {
  const node = el(`<div class="screen editor-screen">
    <div class="panel">
      <h2>This week’s words</h2>
      <p class="help">One word per line. Optionally add <b>|</b> and a sentence the game reads aloud:<br/><code>refill | Can you refill my water bottle?</code></p>
      <label>List name<input id="ed-title" type="text" value="${esc(list.title)}" maxlength="40"/></label>
      <div class="ed-cols">
        <label>Spelling words<textarea id="ed-words" rows="11" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(list.words)}</textarea></label>
        <label>Bonus words <small>(optional)</small><textarea id="ed-bonus" rows="11" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(list.bonus)}</textarea></label>
      </div>
      <p class="ed-count"></p>
      <div class="voice-box">
        <h3>Reading voice</h3>
        <div class="voice-row">
          <select id="ed-voice" aria-label="Voice"></select>
          <div class="seg" role="group" aria-label="Speed">
            <button data-speed="slow">🐢 Slow</button>
            <button data-speed="normal">Normal</button>
            <button data-speed="quick">🐇 Quick</button>
          </div>
          <button class="btn ghost small" id="ed-test">▶ Test</button>
        </div>
        <p class="help voice-help"></p>
      </div>
      <div class="ed-actions">
        <button class="btn ghost" id="ed-reset">Reset to built-in list</button>
        <span class="spacer"></span>
        <button class="btn ghost" id="ed-cancel">Cancel</button>
        <button class="btn primary" id="ed-save">Save words</button>
      </div>
    </div>
  </div>`);
  const t = node.querySelector<HTMLInputElement>('#ed-title')!;
  const w = node.querySelector<HTMLTextAreaElement>('#ed-words')!;
  const b = node.querySelector<HTMLTextAreaElement>('#ed-bonus')!;
  const count = node.querySelector('.ed-count')!;
  const recount = (): void => {
    const p = parseList({ title: t.value, words: w.value, bonus: b.value });
    count.textContent = `${p.main.length} words · ${p.bonus.length} bonus`;
  };
  recount();
  w.addEventListener('input', recount);
  b.addEventListener('input', recount);
  wireVoicePicker(node, () => parseList({ title: t.value, words: w.value, bonus: b.value }).main[0]);
  node.querySelector('#ed-cancel')!.addEventListener('click', () => showTitle());
  node.querySelector('#ed-reset')!.addEventListener('click', () => {
    t.value = DEFAULT_LIST.title;
    w.value = DEFAULT_LIST.words;
    b.value = DEFAULT_LIST.bonus;
    recount();
  });
  node.querySelector('#ed-save')!.addEventListener('click', () => {
    const next: WordList = { title: t.value.trim() || 'My Words', words: w.value, bonus: b.value };
    const same = next.title === DEFAULT_LIST.title && next.words === DEFAULT_LIST.words && next.bonus === DEFAULT_LIST.bonus;
    saveList(same ? null : next);
    list = next;
    sfx.hint();
    showTitle();
  });
  setScreen('editor', node);
}

/** Voice + speed controls. Saved the moment they change, separately from the words. */
function wireVoicePicker(node: HTMLElement, sample: () => WordEntry | undefined): void {
  const select = node.querySelector<HTMLSelectElement>('#ed-voice')!;
  const help = node.querySelector<HTMLElement>('.voice-help')!;
  const test = (): void => {
    const e = sample() ?? { word: 'spelling', sentence: 'I practice my spelling every week.', bonus: false };
    sayWord(e, true);
  };
  const paint = (): void => {
    const voices = listVoices();
    const { activeId, speed } = getVoiceSettings();
    select.replaceChildren(
      ...(voices.length
        ? voices.map((v) => {
            const o = document.createElement('option');
            o.value = v.id;
            o.textContent = v.label;
            o.selected = v.id === activeId;
            return o;
          })
        : [Object.assign(document.createElement('option'), { textContent: 'Default voice' })]),
    );
    select.disabled = !voices.length;
    node.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.speed === speed));
    const best = voices[0]?.quality ?? 0;
    help.innerHTML =
      best >= 3
        ? 'Voices marked ★ sound the most natural.'
        : '<b>Want a far more natural voice?</b> On the iPad open <b>Settings → Accessibility → Spoken Content → Voices → English</b>, download a <b>Premium</b> voice (Ava, Zoe or Evan sound great), then come back and pick it here.';
  };
  paint();
  const off = onVoicesChanged(paint);
  const obs = new MutationObserver(() => {
    if (!node.isConnected) {
      off();
      obs.disconnect();
    }
  });
  obs.observe(app, { childList: true });
  select.addEventListener('change', () => {
    setVoiceSettings({ voiceId: select.value });
    test();
  });
  node.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      setVoiceSettings({ speed: b.dataset.speed as Speed });
      sfx.tap();
      paint();
      test();
    }),
  );
  node.querySelector('#ed-test')!.addEventListener('click', test);
}

// ---------------------------------------------------------------- play

function startRound(mode: Mode, entries: WordEntry[]): void {
  const order = shuffle(entries);
  round = {
    mode,
    entries: order,
    queue: order.slice(),
    retried: new Set(),
    best: new Map(),
    first: new Map(),
    score: 0,
    streak: 0,
    bestStreak: 0,
    played: 0,
  };
  displayScore = 0;
  sky.energy = 0;
  sky.clearFlyers();

  const node = el(`<div class="screen play-screen mode-${mode}">
    <div class="hud">
      <svg class="constellation" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="hud-row">
        <div class="pill score-pill"><span class="pill-label">Score</span><span id="score">0</span></div>
        <div class="pill streak-pill" id="streak" hidden>🔥 <span></span> perfect in a row</div>
      </div>
    </div>
    <div class="stage">
      <div class="prompt">
        <p class="progress"></p>
        <div class="say-row">
          <button class="say-btn" id="say"><span class="say-icon">🔊</span> Hear the word</button>
          <button class="say-btn small" id="sentence">💬 Sentence</button>
        </div>
      </div>
      <div class="peek" aria-live="polite"></div>
      <div class="slots"></div>
      <div class="banner"></div>
      <div class="bank"></div>
      <div class="tools">
        <button class="tool-btn" id="hint">💡 Hint</button>
        <button class="tool-btn" id="peek">👀 Peek</button>
        <button class="tool-btn next-btn" id="next" hidden>Next ➜</button>
      </div>
    </div>
  </div>`);

  node.querySelector('#say')!.addEventListener('click', () => {
    if (!turn) return;
    sfx.tap();
    sayWord(turn.entry, false);
    restart(node.querySelector('.say-icon')!, 'ping');
  });
  node.querySelector('#sentence')!.addEventListener('click', () => {
    if (!turn) return;
    sfx.tap();
    sayWord(turn.entry, true);
  });
  node.querySelector('#hint')!.addEventListener('click', () => useHint());
  node.querySelector('#peek')!.addEventListener('click', () => usePeek());
  node.querySelector('#next')!.addEventListener('click', () => nextWord());

  setScreen('play', node);
  drawConstellation(node.querySelector('.constellation')!, round, false);
  nextWord();
}

function drawConstellation(svg: SVGSVGElement, r: Round, big: boolean): void {
  const n = r.entries.length;
  const gap = 46;
  const w = Math.max(n * gap, 120);
  const h = big ? 120 : 64;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const pts = r.entries.map((_, i) => {
    const x = gap / 2 + i * gap + (w - n * gap) / 2;
    const wave = [0.3, 0.72, 0.45, 0.15, 0.6, 0.85, 0.35][i % 7];
    const y = 14 + wave * (h - 28);
    return { x, y };
  });
  let s = '';
  for (let i = 0; i < n - 1; i++) {
    s += `<line class="c-line" data-i="${i}" x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[i + 1].x}" y2="${pts[i + 1].y}"/>`;
  }
  r.entries.forEach((e, i) => {
    const p = pts[i];
    s += `<g class="c-star${e.bonus ? ' bonus' : ''}" data-word="${e.word}" transform="translate(${p.x} ${p.y})">
      <circle class="c-halo" r="13"/>
      <g class="c-shape"><path d="M0-11 3.2-3.6 11-3.4 4.9 1.6 7 9.3 0 5 -7 9.3-4.9 1.6-11-3.4-3.2-3.6Z"/></g>
      ${big ? `<text y="24" class="c-label">${e.word}</text>` : ''}
    </g>`;
  });
  svg.innerHTML = s;
  r.entries.forEach((e) => paintStar(svg, r, e.word, false));
}

function paintStar(svg: SVGSVGElement, r: Round, word: string, pop: boolean): void {
  const g = svg.querySelector<SVGGElement>(`.c-star[data-word="${word}"]`);
  if (!g) return;
  const stars = r.best.get(word) || 0;
  g.dataset.stars = String(stars);
  if (pop) {
    g.classList.remove('pop');
    void (g as unknown as HTMLElement).getBoundingClientRect();
    g.classList.add('pop');
  }
  const lit = (w: string): boolean => (r.best.get(w) || 0) > 0;
  svg.querySelectorAll<SVGLineElement>('.c-line').forEach((l) => {
    const i = Number(l.dataset.i);
    l.classList.toggle('lit', lit(r.entries[i].word) && lit(r.entries[i + 1].word));
  });
}

function setCurrentStar(word: string | null): void {
  app.querySelectorAll('.constellation .c-star').forEach((g) => {
    g.classList.toggle('current', (g as SVGGElement).dataset.word === word);
  });
}

function sizeBoard(): void {
  if (!turn || screen !== 'play') return;
  const len = turn.entry.word.length;
  const W = Math.min(window.innerWidth, 1000) - 32;
  const H = window.innerHeight;
  const slot = Math.max(30, Math.min(84, Math.floor(W / len) - 10, H * 0.11));
  app.style.setProperty('--slot', slot + 'px');
  const tiles = turn.tiles.length || 1;
  const perRow = Math.min(tiles, len <= 7 ? 7 : 8);
  const tile = Math.max(44, Math.min(86, Math.floor(W / perRow) - 12, H * 0.11));
  app.style.setProperty('--tile', tile + 'px');
  const key = Math.max(28, Math.min(66, Math.floor(W / 10) - 7, H * 0.085));
  app.style.setProperty('--key', key + 'px');
}

function nextWord(): void {
  if (!round) return;
  window.clearTimeout(advanceTimer);
  const entry = round.queue.shift();
  if (!entry) {
    showResults();
    return;
  }
  const root = app.querySelector('.play-screen')!;
  const word = entry.word;
  const mode = round.mode;
  const retry = round.retried.has(word);
  round.played++;

  const slots: (string | null)[] = new Array(word.length).fill(null);
  const kind: Turn['kind'] = new Array(word.length).fill('empty');
  let bankLetters: string[] = [];

  if (mode === 'gaps') {
    const blanks = Math.max(1, Math.min(word.length - 1, Math.round(word.length * 0.45)));
    const idx = shuffle([...word].map((_, i) => i)).slice(0, blanks);
    for (let i = 0; i < word.length; i++) {
      if (!idx.includes(i)) {
        slots[i] = word[i];
        kind[i] = 'given';
      }
    }
    const missing = idx.map((i) => word[i]);
    const decoys = shuffle([...DECOYS].filter((c) => !missing.includes(c))).slice(0, Math.min(3, 8 - missing.length + 1));
    bankLetters = shuffle([...missing, ...decoys]);
  } else if (mode === 'scramble') {
    let s = shuffle([...word]);
    for (let tries = 0; tries < 10 && s.join('') === word && word.length > 1; tries++) s = shuffle([...word]);
    bankLetters = s;
  }

  turn = {
    entry,
    slots,
    kind,
    slotEls: [],
    tiles: [],
    keys: new Map(),
    mistakes: 0,
    hints: 0,
    peeked: false,
    slotMisses: 0,
    done: false,
  };

  const total = round.entries.length;
  const doneCount = round.best.size;
  root.querySelector('.progress')!.innerHTML = retry
    ? `<span class="again">One more try!</span>`
    : `${MODES[mode].icon} ${MODES[mode].name} · word ${Math.min(doneCount + 1, total)} of ${total}${entry.bonus ? ' · <span class="bonus-tag">bonus</span>' : ''}`;

  const slotsEl = root.querySelector('.slots')!;
  slotsEl.replaceChildren();
  slots.forEach((ch, i) => {
    const s = el(`<div class="slot ${kind[i]}" style="animation-delay:${i * 0.04}s"><span>${ch ?? ''}</span></div>`);
    slotsEl.appendChild(s);
    turn!.slotEls.push(s);
  });

  const bank = root.querySelector('.bank')!;
  bank.replaceChildren();
  bank.className = 'bank' + (mode === 'listen' ? ' keyboard' : '');
  if (mode === 'listen') {
    for (const row of QWERTY) {
      const r = el(`<div class="key-row"></div>`);
      for (const c of row) {
        const k = el<HTMLButtonElement>(`<button class="key" data-l="${c}">${c}</button>`);
        k.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          pressLetter(c, k);
        });
        r.appendChild(k);
        turn.keys.set(c, k);
      }
      bank.appendChild(r);
    }
  } else {
    bankLetters.forEach((c, i) => {
      const t = el<HTMLButtonElement>(`<button class="tile" style="animation-delay:${0.1 + i * 0.045}s">${c}</button>`);
      const tile: Tile = { letter: c, used: false, el: t };
      t.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        if (!tile.used) pressLetter(c, t);
      });
      bank.appendChild(t);
      turn!.tiles.push(tile);
    });
  }

  root.querySelector('.banner')!.className = 'banner';
  root.querySelector<HTMLElement>('.peek')!.className = 'peek';
  (root.querySelector('#next') as HTMLElement).hidden = true;
  (root.querySelector('#hint') as HTMLElement).hidden = false;
  (root.querySelector('#peek') as HTMLElement).hidden = false;
  root.querySelector('.stage')!.classList.remove('solved');
  setCurrentStar(word);
  sizeBoard();
  markNext();
  sayWord(entry, mode === 'listen' || retry);
}

function nextIndex(): number {
  return turn ? turn.slots.findIndex((s) => s === null) : -1;
}

function markNext(): void {
  if (!turn) return;
  const n = nextIndex();
  turn.slotEls.forEach((s, i) => s.classList.toggle('next', i === n && !turn!.done));
  app.querySelectorAll('.nudge').forEach((e) => e.classList.remove('nudge'));
}

function findTile(letter: string, preferred?: HTMLElement): Tile | undefined {
  if (!turn) return undefined;
  return (
    turn.tiles.find((t) => !t.used && t.el === preferred && t.letter === letter) ||
    turn.tiles.find((t) => !t.used && t.letter === letter)
  );
}

function pressLetter(letter: string, source?: HTMLElement): void {
  if (!turn || turn.done || !round) return;
  const i = nextIndex();
  if (i < 0) return;
  const want = turn.entry.word[i];
  const tileMode = round.mode !== 'listen';
  const src = source ?? (tileMode ? findTile(letter)?.el : turn.keys.get(letter));

  if (letter === want && (!tileMode || findTile(letter, source))) {
    if (tileMode) {
      const t = findTile(letter, source)!;
      t.used = true;
      t.el.classList.add('used');
      flyLetter(t.el, turn.slotEls[i], letter);
    } else if (src) {
      restart(src, 'hit');
      flyLetter(src, turn.slotEls[i], letter);
    }
    place(i, letter, 'typed');
    return;
  }

  // Wrong letter: gentle, never punishing.
  turn.mistakes++;
  turn.slotMisses++;
  sfx.wrong();
  sky.kick(5);
  if (src) restart(src, 'shake');
  restart(turn.slotEls[i], 'miss');
  if (turn.slotMisses >= 3) nudge(want);
}

function nudge(letter: string): void {
  if (!turn) return;
  const target = round?.mode === 'listen' ? turn.keys.get(letter) : findTile(letter)?.el;
  target?.classList.add('nudge');
}

function flyLetter(from: HTMLElement, to: HTMLElement, letter: string): void {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const ghost = el(`<div class="fly-letter">${letter}</div>`);
  ghost.style.left = a.left + 'px';
  ghost.style.top = a.top + 'px';
  ghost.style.width = a.width + 'px';
  ghost.style.height = a.height + 'px';
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = b.width / a.width;
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(1 + s) / 2 + 0.15}) rotate(-6deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2 },
    ],
    { duration: 200, easing: 'cubic-bezier(.3,.7,.4,1)' },
  );
  anim.onfinish = () => ghost.remove();
}

function place(i: number, letter: string, how: 'typed' | 'hint'): void {
  if (!turn || !round) return;
  turn.slots[i] = letter;
  turn.kind[i] = how;
  turn.slotMisses = 0;
  const s = turn.slotEls[i];
  s.className = `slot ${how}`;
  s.querySelector('span')!.textContent = letter;
  restart(s, 'land');
  const c = center(s);
  sky.fizz(c.x, c.y, how === 'hint' ? COLORS.teal : COLORS.gold, 9);
  if (how === 'hint') sfx.hint();
  else sfx.letter(i, round.streak);
  markNext();
  if (nextIndex() < 0) finishWord();
}

function useHint(): void {
  if (!turn || turn.done || !round) return;
  const i = nextIndex();
  if (i < 0) return;
  const letter = turn.entry.word[i];
  turn.hints++;
  if (round.mode !== 'listen') {
    const t = findTile(letter);
    if (t) {
      t.used = true;
      t.el.classList.add('used');
      flyLetter(t.el, turn.slotEls[i], letter);
    }
  } else {
    const hintBtn = app.querySelector<HTMLElement>('#hint');
    if (hintBtn) flyLetter(hintBtn, turn.slotEls[i], letter);
  }
  place(i, letter, 'hint');
}

function usePeek(): void {
  if (!turn || turn.done) return;
  if (!turn.peeked) {
    turn.peeked = true;
    turn.hints++;
  }
  sfx.hint();
  const p = app.querySelector<HTMLElement>('.peek')!;
  p.textContent = turn.entry.word;
  restart(p, 'show');
  sayWord(turn.entry, false);
}

function finishWord(): void {
  if (!turn || !round) return;
  const t = turn;
  const r = round;
  t.done = true;
  const word = t.entry.word;
  const penalty = t.mistakes + t.hints;
  const stars = penalty === 0 ? 3 : penalty <= 2 ? 2 : 1;

  if (!r.first.has(word)) r.first.set(word, stars);
  const prevBest = r.best.get(word) || 0;
  r.best.set(word, Math.max(prevBest, stars));
  r.streak = stars === 3 ? r.streak + 1 : 0;
  r.bestStreak = Math.max(r.bestStreak, r.streak);
  const gained = stars * 100 + (stars === 3 ? Math.min(r.streak, 10) * 25 : 0);
  r.score += gained;
  sky.energy = Math.min(1, r.streak / 5);
  document.body.style.setProperty('--energy', String(sky.energy));

  if (stars === 1 && !r.retried.has(word)) {
    r.retried.add(word);
    r.queue.push(t.entry);
  }

  // Juice: cascade bounce, bursts per slot, banner, stars fly to the sky.
  const root = app.querySelector('.play-screen')!;
  root.querySelector('.stage')!.classList.add('solved');
  t.slotEls.forEach((s, i) => {
    s.style.animationDelay = `${i * 0.05}s`;
    restart(s, 'win');
    window.setTimeout(() => {
      if (turn !== t) return;
      const c = center(s);
      sky.burst(c.x, c.y, stars === 3 ? 16 : 9, [COLORS.gold, COLORS.pink, COLORS.teal, COLORS.white], 230, 0.9);
    }, i * 50);
  });
  sfx.word(stars, r.streak);
  sky.kick(stars === 3 ? 7 : 3);
  window.setTimeout(() => speak([word]), 350);

  const praise = stars === 3 ? (r.streak >= 3 ? 'Super Star!' : 'Perfect!') : stars === 2 ? 'Great job!' : 'You got it!';
  const banner = root.querySelector<HTMLElement>('.banner')!;
  banner.innerHTML = `<span class="praise">${praise}</span><span class="banner-stars">${[1, 2, 3]
    .map((n) => `<i class="${n <= stars ? 'on' : ''}" style="animation-delay:${0.15 + n * 0.12}s">${STAR_SVG}</i>`)
    .join('')}</span><span class="gain">+${gained}</span>`;
  restart(banner, 'show');

  const svg = root.querySelector<SVGSVGElement>('.constellation')!;
  const target = svg.querySelector(`.c-star[data-word="${word}"]`);
  const from = center(root.querySelector('.slots')!);
  if (target) {
    const to = center(target);
    for (let k = 0; k < stars; k++) {
      window.setTimeout(() => {
        sky.fly(from.x + (k - 1) * 40, from.y, to.x, to.y, () => {
          sfx.starLand();
          if (k === stars - 1 && round === r) paintStar(svg, r, word, true);
        });
      }, 250 + k * 140);
    }
  }

  const streakEl = root.querySelector<HTMLElement>('#streak')!;
  streakEl.hidden = r.streak < 2;
  if (r.streak >= 2) {
    streakEl.querySelector('span')!.textContent = String(r.streak);
    restart(streakEl, 'pop');
  }
  tickScore();

  (root.querySelector('#hint') as HTMLElement).hidden = true;
  (root.querySelector('#peek') as HTMLElement).hidden = true;
  const next = root.querySelector<HTMLElement>('#next')!;
  next.hidden = false;
  restart(next, 'pop');
  advanceTimer = window.setTimeout(() => {
    if (turn === t) nextWord();
  }, 2600);
}

function tickScore(): void {
  const elScore = app.querySelector<HTMLElement>('#score');
  if (!elScore || !round) return;
  const target = round.score;
  const start = displayScore;
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / 700);
    const e = 1 - Math.pow(1 - k, 3);
    displayScore = Math.round(start + (target - start) * e);
    elScore.textContent = displayScore.toLocaleString();
    if (k < 1 && elScore.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  restart(elScore.parentElement!, 'bump');
}

// ---------------------------------------------------------------- results

function showResults(): void {
  if (!round) return;
  const r = round;
  turn = null;
  const total = r.entries.length;
  const stars = [...r.best.values()].reduce((a, b) => a + b, 0);
  const tricky = r.entries.filter((e) => (r.first.get(e.word) || 0) < 3);
  const fullList = r.entries.length === roundEntries().length;
  let isBest = false;
  if (fullList) {
    const prev = loadBest(r.mode);
    if (!prev || r.score > prev.score) {
      isBest = !!prev;
      localStorage.setItem(bestKey(r.mode), JSON.stringify({ score: r.score, stars: Math.max(stars, prev?.stars || 0), of: total * 3 }));
    } else if (stars > prev.stars) {
      localStorage.setItem(bestKey(r.mode), JSON.stringify({ ...prev, stars }));
    }
  }
  const pct = stars / (total * 3);
  const title = pct === 1 ? 'Superstar Speller!' : pct >= 0.8 ? 'Shining Bright!' : pct >= 0.5 ? 'Great Practice!' : 'Keep Practicing!';

  const node = el(`<div class="screen results-screen">
    <h2 class="res-title">${title}</h2>
    <p class="res-sub">You lit up the ${esc(list.title)} constellation</p>
    <svg class="constellation big" preserveAspectRatio="xMidYMid meet"></svg>
    <div class="res-stats">
      <div class="stat"><span class="stat-num" id="res-stars">0</span><span class="stat-label">of ${total * 3} stars</span></div>
      <div class="stat"><span class="stat-num" id="res-score">0</span><span class="stat-label">${isBest ? '🏆 new best!' : 'points'}</span></div>
      <div class="stat"><span class="stat-num">${r.bestStreak}</span><span class="stat-label">best streak</span></div>
    </div>
    ${
      tricky.length
        ? `<div class="tricky"><p>Words to practice:</p><div class="chips">${tricky
            .map((e) => `<button class="chip" data-w="${e.word}">${e.word}</button>`)
            .join('')}</div></div>`
        : `<p class="all-perfect">Every word perfect on the first try! 🌟</p>`
    }
    <div class="res-actions">
      ${tricky.length ? `<button class="btn primary" id="res-tricky">Practice tricky words</button>` : ''}
      <button class="btn ${tricky.length ? 'ghost' : 'primary'}" id="res-again">Play again</button>
      <button class="btn ghost" id="res-menu">Choose a game</button>
    </div>
  </div>`);
  setScreen('results', node);
  round = r;
  drawConstellation(node.querySelector('.constellation')!, r, true);
  node.querySelectorAll<HTMLButtonElement>('.tricky .chip').forEach((c) =>
    c.addEventListener('click', () => {
      const e = r.entries.find((x) => x.word === c.dataset.w);
      if (e) sayWord(e, true);
      restart(c, 'ping');
    }),
  );
  node.querySelector('#res-tricky')?.addEventListener('click', () => {
    sfx.tap();
    startRound(r.mode, tricky);
  });
  node.querySelector('#res-again')!.addEventListener('click', () => {
    sfx.tap();
    startRound(r.mode, roundEntries());
  });
  node.querySelector('#res-menu')!.addEventListener('click', () => {
    sfx.tap();
    showTitle();
  });

  sfx.fanfare();
  sky.energy = pct;
  const W = window.innerWidth;
  for (let k = 0; k < 6; k++) {
    window.setTimeout(() => {
      if (screen !== 'results') return;
      sky.burst(W * (0.15 + Math.random() * 0.7), window.innerHeight * (0.2 + Math.random() * 0.4), 40, undefined, 320, 1.1);
      sky.kick(3);
    }, 200 + k * 260);
  }
  countUp(node.querySelector('#res-stars')!, stars, 900);
  countUp(node.querySelector('#res-score')!, r.score, 1300);
}

function countUp(e: HTMLElement, to: number, ms: number): void {
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / ms);
    e.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1 && e.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', (ev) => {
  const target = ev.target as HTMLElement;
  if (target.matches('input, textarea')) return;
  if (screen !== 'play' || !turn) return;
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (/^[a-z]$/.test(k)) {
    ev.preventDefault();
    if (round?.mode === 'listen') {
      const key = turn.keys.get(k);
      pressLetter(k, key);
    } else {
      pressLetter(k);
    }
  } else if (k === 'enter' || k === ' ') {
    ev.preventDefault();
    if (turn.done) nextWord();
    else sayWord(turn.entry, false);
  }
});

// ---------------------------------------------------------------- debug hook

declare global {
  interface Window {
    __game: unknown;
  }
}
window.__game = {
  get screen() {
    return screen;
  },
  get word() {
    return turn?.entry.word ?? null;
  },
  get score() {
    return round?.score ?? 0;
  },
  get streak() {
    return round?.streak ?? 0;
  },
  get remaining() {
    return round?.queue.length ?? 0;
  },
  get turn() {
    return turn ? { slots: turn.slots.slice(), mistakes: turn.mistakes, hints: turn.hints, done: turn.done } : null;
  },
  get particles() {
    return sky.activeParticles;
  },
  start: (mode: Mode) => startRound(mode, roundEntries()),
  type: (l: string) => pressLetter(l),
  next: () => nextWord(),
  spellCurrent: () => {
    for (let i = nextIndex(); turn && !turn.done && i >= 0; i = nextIndex()) pressLetter(turn.entry.word[i]);
  },
};

showTitle();
