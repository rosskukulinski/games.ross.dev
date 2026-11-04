/**
 * All sound is synthesised with Web Audio: an engine hum that follows speed,
 * drift squeal, boosts, items, hits, countdown, fanfare and a chiptune loop.
 * Nothing is downloaded, so the game is silent-safe offline and tiny.
 */
import type { ItemId } from './shared/items.ts';

const MUTE_KEY = 'rocketKarts.muted';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private driftGain: GainNode | null = null;
  private driftSrc: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private starLoop: ReturnType<typeof setInterval> | null = null;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);

    // noise bed for drifts and dust
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // engine
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 55.5;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.sfx);
    this.engineOsc.start();
    this.engineOsc2.start();

    // drift squeal
    this.driftSrc = ctx.createBufferSource();
    this.driftSrc.buffer = this.noise;
    this.driftSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2.5;
    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = 0;
    this.driftSrc.connect(bp).connect(this.driftGain).connect(this.sfx);
    this.driftSrc.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  // --- Continuous ---------------------------------------------------------

  setEngine(on: boolean, speedFrac: number, boosting: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter || !this.engineOsc2) return;
    const t = this.ctx.currentTime;
    const f = 48 + speedFrac * 150 + (boosting ? 40 : 0);
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.005 + 0.7, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speedFrac * 900 + (boosting ? 600 : 0), t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedFrac * 0.07 : 0, t, 0.1);
  }

  setDrift(on: boolean, tier: number): void {
    if (!this.ctx || !this.driftGain) return;
    this.driftGain.gain.setTargetAtTime(on ? 0.05 + tier * 0.02 : 0, this.ctx.currentTime, 0.06);
  }

  // --- One-shots ----------------------------------------------------------

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, filterFreq: number, when = 0): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  uiClick(): void {
    this.tone(880, 0.06, 'square', 0.06);
    this.tone(1320, 0.08, 'square', 0.04, 0.04);
  }

  countdown(go: boolean): void {
    if (go) {
      this.tone(880, 0.5, 'square', 0.14);
      this.tone(1320, 0.5, 'square', 0.08);
    } else {
      this.tone(440, 0.22, 'square', 0.12);
    }
  }

  pickup(): void {
    for (let i = 0; i < 4; i++) this.tone(660 * Math.pow(1.26, i), 0.12, 'triangle', 0.08, i * 0.05);
  }

  useItem(item: ItemId): void {
    switch (item) {
      case 'turbo':
        this.boost(2);
        break;
      case 'rocket':
        this.burst(0.5, 0.25, 2500);
        this.tone(220, 0.5, 'sawtooth', 0.12, 0, 90);
        break;
      case 'bubble':
        this.tone(520, 0.15, 'sine', 0.1, 0, 780);
        break;
      case 'star':
        this.starOn(true);
        break;
      case 'zap':
        this.burst(0.35, 0.3, 6000);
        this.tone(1600, 0.35, 'square', 0.1, 0, 200);
        this.tone(2400, 0.25, 'sawtooth', 0.08, 0.05, 300);
        break;
    }
  }

  boost(tier: number): void {
    const base = 180 + tier * 60;
    this.tone(base, 0.45, 'sawtooth', 0.12, 0, base * 3.2);
    this.burst(0.4, 0.14, 1800);
  }

  padBoost(): void {
    this.tone(300, 0.3, 'square', 0.08, 0, 900);
  }

  bump(): void {
    this.burst(0.12, 0.18, 900);
    this.tone(120, 0.15, 'triangle', 0.1, 0, 60);
  }

  hit(): void {
    this.burst(0.35, 0.35, 1400);
    this.tone(400, 0.6, 'sawtooth', 0.14, 0, 70);
    this.tone(1000, 0.2, 'square', 0.06, 0.05, 300);
  }

  trapPop(): void {
    this.tone(900, 0.12, 'sine', 0.1, 0, 1500);
    this.burst(0.15, 0.12, 3000);
  }

  rocketPop(): void {
    this.burst(0.4, 0.3, 1200);
    this.tone(160, 0.4, 'triangle', 0.12, 0, 50);
  }

  lap(): void {
    this.tone(660, 0.12, 'square', 0.08);
    this.tone(990, 0.2, 'square', 0.08, 0.12);
  }

  wrongWay(): void {
    this.tone(300, 0.12, 'square', 0.06);
  }

  finish(place: number): void {
    this.starOn(false);
    const notes = place === 1 ? [523, 659, 784, 1047, 1319] : place === 2 ? [523, 659, 784, 1047] : [392, 523, 659];
    notes.forEach((f, i) => {
      this.tone(f, 0.28, 'square', 0.1, i * 0.13);
      this.tone(f / 2, 0.28, 'triangle', 0.08, i * 0.13);
    });
    if (place === 1) this.tone(1568, 0.7, 'square', 0.08, notes.length * 0.13);
  }

  starOn(on: boolean): void {
    if (this.starLoop) {
      clearInterval(this.starLoop);
      this.starLoop = null;
    }
    if (!on) return;
    const seq = [880, 1108, 1318, 1760, 1318, 1108];
    let i = 0;
    const tick = (): void => {
      this.tone(seq[i % seq.length], 0.11, 'square', 0.05);
      i++;
    };
    tick();
    this.starLoop = setInterval(tick, 110);
  }

  // --- Music ---------------------------------------------------------------

  private static BASS = [
    [48, 48, 55, 55, 53, 53, 50, 50],
    [48, 48, 55, 55, 57, 57, 50, 50],
  ];
  private static LEAD = [
    [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 74, 76, 0, 79, 0, 0],
    [74, 0, 77, 81, 0, 77, 76, 0, 74, 0, 72, 71, 0, 72, 0, 0],
    [72, 0, 76, 79, 0, 84, 0, 83, 81, 0, 79, 76, 0, 74, 0, 0],
    [77, 0, 76, 74, 0, 72, 0, 74, 76, 0, 79, 0, 76, 0, 74, 72],
  ];

  music(on: boolean): void {
    if (!on) {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
      return;
    }
    if (this.musicTimer || !this.ctx) return;
    this.musicStep = 0;
    this.musicNext = this.ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const stepDur = 60 / 136 / 4; // 136 BPM, 16ths
    const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
    while (this.musicNext < this.ctx.currentTime + 0.25) {
      const when = this.musicNext - this.ctx.currentTime;
      const step = this.musicStep;
      const bar = Math.floor(step / 16) % 4;
      const s16 = step % 16;
      const lead = AudioEngine.LEAD[bar][s16];
      if (lead) this.tone(mtof(lead), stepDur * 1.6, 'square', 0.05, when, undefined, this.musicGain);
      if (s16 % 2 === 0) {
        const bass = AudioEngine.BASS[bar % 2][(s16 / 2) | 0];
        this.tone(mtof(bass), stepDur * 1.8, 'triangle', 0.09, when, undefined, this.musicGain);
      }
      if (s16 % 4 === 0) this.tone(90, 0.09, 'sine', 0.12, when, 40, this.musicGain);
      if (s16 % 4 === 2) this.tone(3000, 0.04, 'square', 0.02, when, undefined, this.musicGain);
      this.musicNext += stepDur;
      this.musicStep++;
    }
  }
}

export const audio = new AudioEngine();
