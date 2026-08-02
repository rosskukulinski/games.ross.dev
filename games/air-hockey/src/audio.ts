/**
 * Synthesized Web Audio — no asset files. Unlocks on the first user gesture
 * and remembers the mute setting.
 */

const MUTE_KEY = 'air-hockey.muted';

class AudioKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    // One second of white noise, reused for every impact transient.
    const len = Math.floor(this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Private browsing; the setting just won't persist.
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
    const peak = opts.gain ?? 0.3;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, freq: number, gainValue: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer || this.muted) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.1;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  paddleHit(power: number): void {
    const p = Math.max(0.15, Math.min(1, power));
    this.tone(150 + p * 130, 0.11, { type: 'sine', gain: 0.16 + p * 0.2, slideTo: 70 });
    this.noise(0.05, 1400 + p * 1800, 0.1 + p * 0.14);
  }

  wallHit(power: number): void {
    const p = Math.max(0.1, Math.min(1, power));
    this.tone(105, 0.08, { type: 'sine', gain: 0.07 + p * 0.11, slideTo: 62 });
    this.noise(0.035, 900, 0.05 + p * 0.07);
  }

  post(power: number): void {
    const p = Math.max(0.1, Math.min(1, power));
    this.tone(880, 0.24, { type: 'square', gain: 0.05 + p * 0.07 });
    this.tone(1320, 0.18, { type: 'sine', gain: 0.04 + p * 0.05 });
  }

  goal(mine: boolean): void {
    const notes = mine ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((f, i) => {
      this.tone(f, 0.3, { type: 'triangle', gain: 0.26, delay: i * 0.09 });
    });
    this.noise(0.3, 500, 0.1);
  }

  win(won: boolean): void {
    const notes = won ? [523, 659, 784, 1047, 1319] : [392, 349, 294, 233];
    notes.forEach((f, i) => {
      this.tone(f, 0.42, { type: 'triangle', gain: 0.3, delay: i * 0.13 });
      this.tone(f * 2, 0.34, { type: 'sine', gain: 0.11, delay: i * 0.13 });
    });
  }

  countdownBeep(last: boolean): void {
    this.tone(last ? 880 : 523, last ? 0.3 : 0.13, { type: 'square', gain: 0.16 });
  }

  uiClick(): void {
    this.tone(660, 0.07, { type: 'square', gain: 0.1 });
  }
}

export const audio = new AudioKit();
