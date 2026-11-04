/** All the DOM chrome around the canvas: menus, pickers, lobby, results. */
import { audio } from './audio.ts';
import { CODE_ALPHABET, CODE_LENGTH } from './shared/codes.ts';
import { KARTS, findKart } from './shared/karts.ts';
import { TRACKS, THEMES, findTrack } from './shared/tracks.ts';
import { buildTrack } from './shared/track.ts';
import type { Difficulty } from './shared/race.ts';
import type { LobbyState } from './shared/protocol.ts';

export type ScreenName =
  | 'menu'
  | 'kart'
  | 'track'
  | 'friend'
  | 'join'
  | 'lobby'
  | 'connecting'
  | 'error'
  | 'results'
  | 'none';

const SCREENS: Exclude<ScreenName, 'none'>[] = ['menu', 'kart', 'track', 'friend', 'join', 'lobby', 'connecting', 'error', 'results'];
const NAME_KEY = 'rocketKarts.name';
const KART_KEY = 'rocketKarts.kart';

export interface ResultRow {
  name: string;
  color: string;
  place: number;
  time: number;
  me: boolean;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

function formatTime(t: number): string {
  if (t < 0) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function placeLabel(place: number): string {
  return `${place}${['st', 'nd', 'rd', 'th'][Math.min(3, place - 1)]}`;
}

export class Ui {
  onSolo: ((kart: string, track: string, difficulty: Difficulty) => void) | null = null;
  onHost: ((name: string, kart: string) => void) | null = null;
  onJoin: ((code: string, name: string, kart: string) => void) | null = null;
  onQuit: (() => void) | null = null;
  onLobbyKart: ((id: string) => void) | null = null;
  onLobbyTrack: ((id: string) => void) | null = null;
  onLobbyDifficulty: ((d: Difficulty) => void) | null = null;
  onReady: ((ready: boolean) => void) | null = null;
  onStart: (() => void) | null = null;
  onAgain: (() => void) | null = null;
  onChangeTrack: (() => void) | null = null;
  onTrackPreview: ((id: string) => void) | null = null;

  kartId = localStorage.getItem(KART_KEY) ?? KARTS[0].id;
  trackId = TRACKS[0].id;
  difficulty: Difficulty = 'normal';
  private current: ScreenName = 'menu';
  private readonly codeBoxes: HTMLInputElement[];
  private ready = false;
  private lobbyTaken = new Set<string>();

  constructor() {
    this.codeBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('.code-box'));
    if (!KARTS.some((k) => k.id === this.kartId)) this.kartId = KARTS[0].id;
    // The name field appears on both the host/join chooser and the code
    // screen (an invite link skips the chooser); keep the two in step.
    const nameInputs = [el<HTMLInputElement>('name-input'), el<HTMLInputElement>('name-input-join')];
    for (const input of nameInputs) {
      input.value = localStorage.getItem(NAME_KEY) ?? '';
      input.addEventListener('input', () => {
        for (const other of nameInputs) if (other !== input) other.value = input.value;
        localStorage.setItem(NAME_KEY, input.value.trim());
      });
    }

    const click = (id: string, fn: () => void): void => {
      el(id).addEventListener('click', () => {
        audio.unlock();
        audio.uiClick();
        fn();
      });
    };

    click('btn-solo', () => {
      this.renderKartPicker(el('kart-picker'), false);
      this.show('kart');
    });
    click('btn-kart-next', () => {
      this.renderTrackPicker(el('track-picker'), false);
      this.show('track');
      this.onTrackPreview?.(this.trackId);
    });
    click('btn-race', () => this.onSolo?.(this.kartId, this.trackId, this.difficulty));
    click('btn-error-solo', () => this.onSolo?.(this.kartId, this.trackId, this.difficulty));
    click('btn-friend', () => this.show('friend'));
    click('btn-host', () => this.onHost?.(this.name(), this.kartId));
    click('btn-join', () => {
      this.show('join');
      this.clearCode();
      this.codeBoxes[0]?.focus();
    });
    click('btn-join-go', () => this.submitCode());
    click('btn-ready', () => {
      this.ready = !this.ready;
      this.onReady?.(this.ready);
    });
    click('btn-start', () => this.onStart?.());
    click('btn-again', () => this.onAgain?.());
    click('btn-change-track', () => this.onChangeTrack?.());
    click('btn-quit', () => this.onQuit?.());
    click('btn-copy', () => void this.copyInviteLink());

    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-back]')) {
      btn.addEventListener('click', () => {
        audio.uiClick();
        const target = btn.dataset.back as ScreenName;
        if (target === 'menu') this.onQuit?.();
        else this.show(target);
      });
    }

    for (const group of document.querySelectorAll<HTMLElement>('.difficulty')) {
      for (const btn of group.querySelectorAll<HTMLButtonElement>('.diff')) {
        btn.addEventListener('click', () => {
          audio.unlock();
          audio.uiClick();
          this.setDifficulty((btn.dataset.diff as Difficulty) ?? 'normal');
          if (group.id === 'lobby-difficulty') this.onLobbyDifficulty?.(this.difficulty);
        });
      }
    }

    const muteBtn = el<HTMLButtonElement>('btn-mute');
    const syncMute = (): void => {
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    };
    muteBtn.addEventListener('click', () => {
      audio.unlock();
      audio.setMuted(!audio.muted);
      syncMute();
      if (!audio.muted) audio.uiClick();
    });
    syncMute();

    this.wireCodeBoxes();
  }

  name(): string {
    const v = el<HTMLInputElement>('name-input').value.trim();
    return v || 'Player';
  }

  // --- Screens -------------------------------------------------------------

  show(name: ScreenName): void {
    this.current = name;
    for (const s of SCREENS) el(`screen-${s}`).classList.toggle('hidden', s !== name);
  }

  get screen(): ScreenName {
    return this.current;
  }

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('.diff')) {
      btn.classList.toggle('is-active', btn.dataset.diff === d);
    }
  }

  setConnectingText(text: string): void {
    el('connecting-text').textContent = text;
  }

  setError(text: string): void {
    el('error-text').textContent = text;
    this.show('error');
  }

  // --- Pickers ---------------------------------------------------------------

  private renderKartPicker(host: HTMLElement, lobby: boolean): void {
    host.innerHTML = '';
    for (const k of KARTS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kart-card';
      card.dataset.kart = k.id;
      card.classList.toggle('is-active', k.id === this.kartId);
      const taken = lobby && this.lobbyTaken.has(k.id) && k.id !== this.kartId;
      card.classList.toggle('is-taken', taken);
      card.innerHTML = `<div class="kart-swatch" style="background:${k.color};--accent:${k.accent}"><div class="helmet"></div></div><div class="name">${k.name}</div><div class="blurb">${k.blurb}</div>`;
      card.addEventListener('click', () => {
        if (card.classList.contains('is-taken')) return;
        audio.unlock();
        audio.uiClick();
        this.kartId = k.id;
        localStorage.setItem(KART_KEY, k.id);
        for (const c of host.querySelectorAll('.kart-card')) c.classList.toggle('is-active', c === card);
        if (lobby) this.onLobbyKart?.(k.id);
      });
      host.appendChild(card);
    }
  }

  private renderTrackPicker(host: HTMLElement, lobby: boolean): void {
    host.innerHTML = '';
    for (const t of TRACKS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'track-card';
      card.dataset.track = t.id;
      card.classList.toggle('is-active', t.id === this.trackId);
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      drawTrackThumb(canvas, t.id);
      card.appendChild(canvas);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.name;
      card.appendChild(name);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${t.laps} laps`;
      card.appendChild(meta);
      card.addEventListener('click', () => {
        audio.unlock();
        audio.uiClick();
        this.trackId = t.id;
        for (const c of host.querySelectorAll('.track-card')) c.classList.toggle('is-active', c === card);
        if (lobby) this.onLobbyTrack?.(t.id);
        else this.onTrackPreview?.(t.id);
      });
      host.appendChild(card);
    }
  }

  // --- Lobby ------------------------------------------------------------------

  setLobbyCode(code: string): void {
    el('lobby-code').textContent = code;
  }

  renderLobby(state: LobbyState, mySlot: number, isHost: boolean): void {
    const list = el('lobby-players');
    list.innerHTML = '';
    this.lobbyTaken = new Set(state.players.filter((p) => p.kind !== 'empty' && p.slot !== mySlot).map((p) => p.kart));
    const me = state.players[mySlot];
    if (me && me.kind === 'human') this.kartId = me.kart;
    const humans = state.players.filter((p) => p.kind === 'human');
    for (const p of state.players) {
      const li = document.createElement('li');
      if (p.kind === 'empty') {
        li.className = 'empty';
        li.innerHTML = `<span class="dot" style="background:#3a3556"></span><span class="who">Open seat</span><span class="state">computer driver</span>`;
      } else {
        const k = findKart(p.kart);
        const stateText = p.kind === 'bot' ? 'computer' : p.host ? 'host' : p.ready ? 'ready' : 'not ready';
        const stateClass = p.host ? 'host' : p.ready ? 'ready' : '';
        li.innerHTML = `<span class="dot" style="background:${k.color}"></span><span class="who">${escapeHtml(p.name)}${p.slot === mySlot ? ' (you)' : ''}</span><span class="state ${stateClass}">${stateText}</span>`;
      }
      list.appendChild(li);
    }
    this.renderKartPicker(el('lobby-kart-picker'), true);
    el('lobby-host-controls').classList.toggle('hidden', !isHost);
    el('lobby-guest-info').classList.toggle('hidden', isHost);
    if (isHost) {
      this.trackId = state.track;
      this.renderTrackPicker(el('lobby-track-picker'), true);
      this.setDifficulty(state.difficulty);
    } else {
      el('lobby-track-name').textContent = `${findTrack(state.track).name} · ${state.difficulty} computer drivers`;
    }
    el('btn-start').classList.toggle('hidden', !isHost);
    el('btn-ready').classList.toggle('hidden', isHost);
    this.ready = me?.ready ?? false;
    el('btn-ready').textContent = this.ready ? "I'm Ready ✓" : "I'm Ready";
    const waiting = humans.filter((p) => !p.host && !p.ready);
    const startBtn = el<HTMLButtonElement>('btn-start');
    startBtn.disabled = waiting.length > 0;
    el('lobby-status').textContent = isHost
      ? waiting.length > 0
        ? `Waiting for ${waiting.map((p) => p.name).join(', ')} to be ready…`
        : humans.length === 1
          ? 'Share the code, or start now and race the computer.'
          : 'Everyone is ready!'
      : this.ready
        ? 'Waiting for the host to start the race…'
        : 'Pick a kart, then tap I’m Ready.';
  }

  setLobbyStatus(text: string): void {
    el('lobby-status').textContent = text;
  }

  // --- Results ------------------------------------------------------------------

  showResults(rows: ResultRow[], opts: { online: boolean; isHost: boolean }): void {
    const me = rows.find((r) => r.me);
    el('results-title').textContent = me ? (me.place === 1 ? '🏆 You Win!' : `${placeLabel(me.place)} Place!`) : 'Race Over!';
    const list = el('results-list');
    list.innerHTML = '';
    for (const r of [...rows].sort((a, b) => a.place - b.place)) {
      const li = document.createElement('li');
      if (r.me) li.className = 'me';
      li.innerHTML = `<span class="pos">${placeLabel(r.place)}</span><span class="dot" style="background:${r.color}"></span><span>${escapeHtml(r.name)}</span><span class="time">${formatTime(r.time)}</span>`;
      list.appendChild(li);
    }
    el('btn-change-track').classList.toggle('hidden', opts.online);
    el('btn-again').classList.toggle('hidden', opts.online && !opts.isHost);
    el('results-status').textContent = opts.online && !opts.isHost ? 'Waiting for the host to start another race…' : '';
    this.show('results');
  }

  // --- Room code entry -------------------------------------------------------------

  private wireCodeBoxes(): void {
    this.codeBoxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        const ch = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        box.value = CODE_ALPHABET.includes(ch) ? ch : '';
        if (box.value && i < this.codeBoxes.length - 1) this.codeBoxes[i + 1].focus();
        if (box.value && i === this.codeBoxes.length - 1) this.submitCode();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          this.codeBoxes[i - 1].focus();
          this.codeBoxes[i - 1].value = '';
          e.preventDefault();
        }
        if (e.key === 'Enter') this.submitCode();
      });
      box.addEventListener('paste', (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        const chars = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
        if (!chars) return;
        e.preventDefault();
        this.codeBoxes.forEach((b, j) => {
          b.value = CODE_ALPHABET.includes(chars[j] ?? '') ? chars[j] : '';
        });
        if (chars.length === CODE_LENGTH) this.submitCode();
      });
    });
  }

  private clearCode(): void {
    for (const b of this.codeBoxes) b.value = '';
  }

  prefillCode(code: string): void {
    this.codeBoxes.forEach((b, i) => {
      b.value = code[i] ?? '';
    });
  }

  private submitCode(): void {
    const code = this.codeBoxes.map((b) => b.value).join('');
    if (code.length !== CODE_LENGTH) {
      this.codeBoxes.find((b) => !b.value)?.focus();
      return;
    }
    audio.unlock();
    audio.uiClick();
    this.onJoin?.(code, this.name(), this.kartId);
  }

  private async copyInviteLink(): Promise<void> {
    const code = el('lobby-code').textContent ?? '';
    const url = `${location.origin}${location.pathname}${location.search}#${code}`;
    const btn = el<HTMLButtonElement>('btn-copy');
    const original = 'Copy Invite Link';
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Copied!';
    } catch {
      btn.textContent = url;
    }
    setTimeout(() => {
      btn.textContent = original;
    }, 2200);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const thumbCache = new Map<string, HTMLCanvasElement>();

/** Little top-down map of a track for the picker cards. */
function drawTrackThumb(canvas: HTMLCanvasElement, trackId: string): void {
  const cached = thumbCache.get(trackId);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (cached) {
    ctx.drawImage(cached, 0, 0);
    return;
  }
  const def = findTrack(trackId);
  const theme = THEMES[def.theme];
  const geom = buildTrack(def);
  const size = canvas.width;
  const xs = geom.samples.map((s) => s.x);
  const zs = geom.samples.map((s) => s.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const pad = 16;
  const scale = Math.min((size - pad * 2) / (maxX - minX), (size - pad * 2) / (maxZ - minZ));
  const offX = (size - (maxX - minX) * scale) / 2;
  const offY = (size - (maxZ - minZ) * scale) / 2;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(0.45, theme.skyHorizon);
  g.addColorStop(0.5, theme.ground);
  g.addColorStop(1, theme.groundAlt);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  geom.samples.forEach((s, i) => {
    const x = offX + (s.x - minX) * scale;
    const y = size - (offY + (s.z - minZ) * scale);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = theme.curbA;
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = theme.road;
  ctx.lineWidth = 8;
  ctx.stroke();
  const s0 = geom.samples[0];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(offX + (s0.x - minX) * scale, size - (offY + (s0.z - minZ) * scale), 3.5, 0, Math.PI * 2);
  ctx.fill();
  const copy = document.createElement('canvas');
  copy.width = size;
  copy.height = size;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  thumbCache.set(trackId, copy);
}
