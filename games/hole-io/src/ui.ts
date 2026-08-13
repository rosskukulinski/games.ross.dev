import { CODE_ALPHABET, CODE_LENGTH } from './shared/rules';

export type ScreenName = 'menu' | 'join' | 'connecting' | 'error' | 'over' | 'none';

const NAME_KEY = 'hole-io-name';
const BEST_KEY = 'hole-io-best';

export interface BoardRow {
  name: string;
  score: number;
  colorCss: string;
  isMe: boolean;
  alive: boolean;
}

export interface StandingRow extends BoardRow {
  bot: boolean;
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

/** All DOM: menus, HUD chips, banner, joystick, toasts. No game logic. */
export class Ui {
  screen: ScreenName = 'menu';

  onSolo: ((name: string) => void) | null = null;
  onHost: ((name: string) => void) | null = null;
  onJoin: ((code: string, name: string) => void) | null = null;
  onQuit: (() => void) | null = null;
  onMute: (() => boolean) | null = null;
  onCopyInvite: (() => void) | null = null;

  private screens: Record<string, HTMLElement> = {};
  private hud = $('hud');
  private timer = $('timer');
  private board = $('board');
  private meChip = $('me-chip');
  private roomChip = $<HTMLButtonElement>('room-chip');
  private banner = $('banner');
  private toastEl = $('toast');
  private nameInput = $<HTMLInputElement>('name-input');
  private codeBoxes: HTMLInputElement[] = [];
  private joy = $('joystick');
  private joyBase = $('joy-base');
  private joyKnob = $('joy-knob');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBoardHtml = '';

  constructor() {
    for (const name of ['menu', 'join', 'connecting', 'error', 'over']) {
      this.screens[name] = $(`screen-${name}`);
    }

    this.nameInput.value = localStorage.getItem(NAME_KEY) ?? '';

    $('btn-solo').addEventListener('click', () => this.onSolo?.(this.playerName()));
    $('btn-host').addEventListener('click', () => this.onHost?.(this.playerName()));
    $('btn-join').addEventListener('click', () => {
      this.show('join');
      this.codeBoxes[0]?.focus();
    });
    $('btn-join-go').addEventListener('click', () => this.submitCode());
    $('btn-error-solo').addEventListener('click', () => this.onSolo?.(this.playerName()));
    $('btn-quit').addEventListener('click', () => this.onQuit?.());
    this.roomChip.addEventListener('click', () => this.onCopyInvite?.());

    const muteBtn = $('btn-mute');
    muteBtn.addEventListener('click', () => {
      const muted = this.onMute?.() ?? false;
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    document.querySelectorAll<HTMLElement>('[data-back]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = el.dataset.back as ScreenName;
        if (this.screen === 'over' || target === 'menu') this.onQuit?.();
        this.show(target);
      });
    });

    this.wireCodeBoxes();
  }

  private playerName(): string {
    const name = this.nameInput.value.trim().slice(0, 12) || 'Player';
    localStorage.setItem(NAME_KEY, name);
    return name;
  }

  private wireCodeBoxes(): void {
    this.codeBoxes = Array.from(
      this.screens.join.querySelectorAll<HTMLInputElement>('.code-box')
    );
    this.codeBoxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (box.value && i < this.codeBoxes.length - 1) this.codeBoxes[i + 1].focus();
        if (this.enteredCode().length === CODE_LENGTH) this.submitCode();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) this.codeBoxes[i - 1].focus();
        if (e.key === 'Enter') this.submitCode();
      });
      box.addEventListener('paste', (e) => {
        const text = (e.clipboardData?.getData('text') ?? '').toUpperCase();
        const chars = [...text].filter((c) => CODE_ALPHABET.includes(c)).slice(0, CODE_LENGTH);
        if (chars.length) {
          e.preventDefault();
          chars.forEach((c, j) => {
            if (this.codeBoxes[j]) this.codeBoxes[j].value = c;
          });
          if (chars.length === CODE_LENGTH) this.submitCode();
        }
      });
    });
  }

  private enteredCode(): string {
    return this.codeBoxes.map((b) => b.value).join('');
  }

  private submitCode(): void {
    const code = this.enteredCode();
    if (code.length === CODE_LENGTH) this.onJoin?.(code, this.playerName());
  }

  prefillCode(code: string): void {
    [...code].forEach((c, i) => {
      if (this.codeBoxes[i]) this.codeBoxes[i].value = c;
    });
  }

  show(name: ScreenName): void {
    this.screen = name;
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
    this.hud.classList.toggle('hidden', name === 'menu' || name === 'connecting' || name === 'error');
    if (name === 'menu') {
      const best = Number(localStorage.getItem(BEST_KEY) ?? '0');
      $('menu-best').textContent = best > 0 ? `Best score: ${best}` : '';
      this.hideJoystick();
      this.clearBanner();
    }
  }

  setError(text: string): void {
    $('error-text').textContent = text;
    this.show('error');
  }

  setConnectingText(text: string): void {
    $('connecting-text').textContent = text;
  }

  // --- HUD ----------------------------------------------------------------

  setTimer(seconds: number, urgent: boolean): void {
    const s = Math.max(0, Math.ceil(seconds));
    const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (this.timer.textContent !== text) this.timer.textContent = text;
    this.timer.classList.toggle('urgent', urgent);
  }

  setBoard(rows: BoardRow[]): void {
    const html = rows
      .map(
        (r) =>
          `<li class="${r.isMe ? 'me' : ''} ${r.alive ? '' : 'dead'}"><span class="dot" style="background:${r.colorCss}"></span><span class="nm">${escapeHtml(r.name)}</span><span class="sc">${r.score}</span></li>`
      )
      .join('');
    if (html !== this.lastBoardHtml) {
      this.lastBoardHtml = html;
      this.board.innerHTML = html;
    }
  }

  setMeChip(score: number, rank: number, total: number): void {
    const html = `${score}<span class="rank">#${rank}/${total}</span>`;
    if (this.meChip.innerHTML !== html) {
      this.meChip.innerHTML = html;
    }
  }

  bumpMeChip(): void {
    this.meChip.classList.remove('bump');
    void this.meChip.offsetWidth;
    this.meChip.classList.add('bump');
    setTimeout(() => this.meChip.classList.remove('bump'), 180);
  }

  setRoomChip(code: string, ping: string): void {
    if (!code) {
      this.roomChip.classList.add('hidden');
      return;
    }
    this.roomChip.classList.remove('hidden');
    const text = ping ? `${code} · ${ping} · Invite` : `${code} · Invite`;
    if (this.roomChip.textContent !== text) this.roomChip.textContent = text;
  }

  // --- Banner + toast ------------------------------------------------------

  showBanner(text: string, opts: { small?: boolean; ttl?: number } = {}): void {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.banner.textContent = text;
    this.banner.classList.remove('hidden', 'pop');
    this.banner.classList.toggle('small', !!opts.small);
    void this.banner.offsetWidth; // restart the pop animation
    this.banner.classList.add('pop');
    if (opts.ttl) {
      this.bannerTimer = setTimeout(() => this.clearBanner(), opts.ttl);
    }
  }

  clearBanner(): void {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = null;
    this.banner.classList.add('hidden');
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), 1800);
  }

  // --- Round over ----------------------------------------------------------

  showStandings(rows: StandingRow[], iWon: boolean): void {
    $('over-heading').textContent = iWon ? '🏆 You Win!' : 'Round Over!';
    const list = $('standings');
    list.innerHTML = rows
      .map(
        (r, i) =>
          `<li class="${r.isMe ? 'me' : ''}"><span class="pl">${i + 1}.</span><span class="dot" style="background:${r.colorCss}"></span><span class="nm">${escapeHtml(r.name)}${r.bot ? ' 🤖' : ''}</span><span class="sc">${r.score}</span></li>`
      )
      .join('');
    this.show('over');
  }

  setOverStatus(text: string): void {
    const el = $('over-status');
    if (el.textContent !== text) el.textContent = text;
  }

  recordBest(score: number): boolean {
    const best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    if (score > best) {
      localStorage.setItem(BEST_KEY, String(score));
      return true;
    }
    return false;
  }

  // --- Joystick -------------------------------------------------------------

  showJoystick(x: number, y: number): void {
    this.joy.classList.remove('hidden');
    this.joyBase.style.left = `${x}px`;
    this.joyBase.style.top = `${y}px`;
    this.moveJoystick(x, y, 0, 0);
  }

  moveJoystick(baseX: number, baseY: number, dx: number, dy: number): void {
    this.joyKnob.style.left = `${baseX + dx * 38}px`;
    this.joyKnob.style.top = `${baseY + dy * 38}px`;
  }

  hideJoystick(): void {
    this.joy.classList.add('hidden');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
