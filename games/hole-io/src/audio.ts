/**
 * All sound is synthesized Web Audio — no asset files, nothing to download.
 * The context unlocks on the first user gesture; mute persists in
 * localStorage.
 */

const MUTE_KEY = 'hole-io-muted';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = localStorage.getItem(MUTE_KEY) === '1';

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    localStorage.setItem(MUTE_KEY, this._muted ? '1' : '0');
    if (this.master) this.master.gain.value = this._muted ? 0 : 1;
    return this._muted;
  }

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private env(
    at: number,
    peak: number,
    attack: number,
    decay: number
  ): GainNode | null {
    if (!this.ctx || !this.master) return null;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(this.master);
    return g;
  }

  private tone(
    type: OscillatorType,
    freq: number,
    endFreq: number,
    peak: number,
    attack: number,
    decay: number,
    delay = 0
  ): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + delay;
    const g = this.env(at, peak, attack, decay);
    if (!g) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + attack + decay);
    osc.connect(g);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  private thump(freq: number, peak: number, decay: number, delay = 0): void {
    this.tone('sine', freq, freq * 0.4, peak, 0.004, decay, delay);
  }

  private noise(peak: number, decay: number, cutoff: number, delay = 0): void {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + delay;
    const g = this.env(at, peak, 0.004, decay);
    if (!g) return;
    const len = Math.ceil(this.ctx.sampleRate * (decay + 0.05));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    src.connect(filter);
    filter.connect(g);
    src.start(at);
    src.stop(at + decay + 0.05);
  }

  /**
   * Nom. Pitch rises with the eating streak so a mowing run sings, and drops
   * with prop value so a tower lands heavier than a flower.
   */
  eat(points: number, streak: number): void {
    const size = Math.min(1, points / 25);
    const base = 320 - size * 180 + Math.min(streak, 12) * 26;
    this.tone('triangle', base * 1.6, base * 0.9, 0.16, 0.006, 0.11);
    this.thump(120 - size * 50, 0.22 + size * 0.2, 0.12 + size * 0.12);
    if (points >= 10) this.noise(0.12, 0.16, 900);
  }

  /** A hole ate a hole. Ours or not changes how dramatic it feels. */
  swallow(mine: boolean): void {
    this.noise(0.24, 0.34, 700);
    this.thump(90, 0.5, 0.4);
    if (mine) {
      this.tone('triangle', 220, 440, 0.2, 0.02, 0.3, 0.1);
      this.tone('triangle', 330, 660, 0.16, 0.02, 0.34, 0.18);
    }
  }

  /** We were the meal. */
  died(): void {
    this.tone('sawtooth', 220, 55, 0.22, 0.01, 0.55);
    this.tone('sine', 110, 40, 0.3, 0.01, 0.6, 0.05);
  }

  respawned(): void {
    this.tone('triangle', 300, 620, 0.16, 0.01, 0.2);
    this.tone('triangle', 450, 900, 0.12, 0.01, 0.22, 0.08);
  }

  countdownBeep(go: boolean): void {
    if (go) {
      this.tone('square', 660, 660, 0.14, 0.005, 0.3);
      this.tone('square', 990, 990, 0.1, 0.005, 0.34, 0.02);
    } else {
      this.tone('square', 440, 440, 0.11, 0.005, 0.12);
    }
  }

  /** Final-seconds clock tick. */
  tick(): void {
    this.tone('square', 900, 880, 0.06, 0.003, 0.05);
  }

  roundEnd(won: boolean): void {
    const notes = won ? [523, 659, 784, 1047] : [392, 349, 330];
    notes.forEach((f, i) => {
      this.tone('triangle', f, f, 0.16, 0.01, 0.32, i * 0.13);
    });
    if (won) this.noise(0.1, 0.5, 2400, 0.4);
  }
}

export const audio = new Audio();
