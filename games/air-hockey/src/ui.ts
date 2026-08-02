import type { Difficulty } from './bot';
import { audio } from './audio';
import { CODE_ALPHABET, CODE_LENGTH } from './shared/rules';

export type ScreenName =
  | 'menu'
  | 'friend'
  | 'host'
  | 'join'
  | 'connecting'
  | 'error'
  | 'over'
  | 'waiting'
  | 'none';

const SCREENS: Exclude<ScreenName, 'none'>[] = [
  'menu',
  'friend',
  'host',
  'join',
  'connecting',
  'error',
  'over',
  'waiting',
];

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

/** All the DOM chrome around the canvas: menus, room codes, HUD chips. */
export class Ui {
  onSolo: ((difficulty: Difficulty) => void) | null = null;
  onHost: (() => void) | null = null;
  onJoin: ((code: string) => void) | null = null;
  onQuit: (() => void) | null = null;
  onRematch: (() => void) | null = null;

  difficulty: Difficulty = 'normal';
  private current: ScreenName = 'menu';
  private readonly codeBoxes: HTMLInputElement[];

  constructor() {
    this.codeBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('.code-box'));

    el('btn-solo').addEventListener('click', () => {
      audio.unlock();
      audio.uiClick();
      this.onSolo?.(this.difficulty);
    });
    el('btn-error-solo').addEventListener('click', () => {
      audio.uiClick();
      this.onSolo?.(this.difficulty);
    });

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.diff')) {
      btn.addEventListener('click', () => {
        audio.unlock();
        audio.uiClick();
        for (const other of document.querySelectorAll('.diff')) other.classList.remove('is-active');
        btn.classList.add('is-active');
        this.difficulty = (btn.dataset.diff as Difficulty) ?? 'normal';
      });
    }

    el('btn-friend').addEventListener('click', () => {
      audio.unlock();
      audio.uiClick();
      this.show('friend');
    });
    el('btn-host').addEventListener('click', () => {
      audio.uiClick();
      this.onHost?.();
    });
    el('btn-join').addEventListener('click', () => {
      audio.uiClick();
      this.show('join');
      this.clearCode();
      this.codeBoxes[0]?.focus();
    });
    el('btn-join-go').addEventListener('click', () => this.submitCode());
    el('btn-again').addEventListener('click', () => {
      audio.uiClick();
      this.onRematch?.();
    });
    el('btn-quit').addEventListener('click', () => {
      audio.uiClick();
      this.onQuit?.();
    });

    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-back]')) {
      btn.addEventListener('click', () => {
        audio.uiClick();
        const target = btn.dataset.back as ScreenName;
        if (target === 'menu') this.onQuit?.();
        else this.show(target);
      });
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

    el('btn-copy').addEventListener('click', () => {
      audio.uiClick();
      void this.copyInviteLink();
    });

    this.wireCodeBoxes();
  }

  // --- Screens -------------------------------------------------------------

  show(name: ScreenName): void {
    this.current = name;
    for (const s of SCREENS) {
      el(`screen-${s}`).classList.toggle('hidden', s !== name);
    }
    // The in-game chips only make sense once a match is on screen.
    const inMatch = name === 'none' || name === 'over' || name === 'waiting';
    el('hud').classList.toggle('hidden', !inMatch);
  }

  get screen(): ScreenName {
    return this.current;
  }

  setHostCode(code: string): void {
    el('host-code').textContent = code;
    el('waiting-code').textContent = code;
  }

  setHostStatus(text: string): void {
    el('host-status').textContent = text;
  }

  setConnectingText(text: string): void {
    el('connecting-text').textContent = text;
  }

  setError(text: string): void {
    el('error-text').textContent = text;
    this.show('error');
  }

  setOverStatus(text: string): void {
    el('over-status').textContent = text;
  }

  setWaitingText(text: string): void {
    el('waiting-text').textContent = text;
  }

  setConnectionInfo(text: string): void {
    el('conn').textContent = text;
  }

  // --- Room code entry -----------------------------------------------------

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
    this.onJoin?.(code);
  }

  private async copyInviteLink(): Promise<void> {
    const code = el('host-code').textContent ?? '';
    const url = `${location.origin}${location.pathname}${location.search}#${code}`;
    const btn = el<HTMLButtonElement>('btn-copy');
    const original = 'Copy Invite Link';
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Copied!';
    } catch {
      // Clipboard API needs a secure context; fall back to showing the link.
      btn.textContent = url;
    }
    setTimeout(() => {
      btn.textContent = original;
    }, 2200);
  }
}
