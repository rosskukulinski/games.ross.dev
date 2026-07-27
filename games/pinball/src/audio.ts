/** Web Audio synth — every sound is oscillators + noise, no files. */

const MUTE_KEY = 'pinball-muted';

class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  muted = false;
  /** 0..1 — drives the ambient bed */
  intensity = 0;
  /** true while a ball is in play; the bed idles otherwise */
  playing = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.master);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* private mode — mute just won't persist */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    o: {
      type?: OscillatorType; vol?: number; slideTo?: number;
      attack?: number; dest?: GainNode | null; when?: number;
    } = {},
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = o.when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + dur);
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, when?: number, type: BiquadFilterType = 'lowpass'): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf) return;
    const t0 = when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---- table sounds -------------------------------------------------------

  /** Metallic clack; softer for grazes. */
  wall(force: number): void {
    const v = Math.min(0.14, 0.02 + force * 0.00007);
    if (v < 0.025) return;
    this.tone(150 + force * 0.05, 0.05, { type: 'triangle', vol: v, slideTo: 90 });
    this.noise(0.03, v * 0.7, 1800);
  }

  flipper(): void {
    this.tone(90, 0.07, { type: 'square', vol: 0.16, slideTo: 55 });
    this.noise(0.05, 0.14, 2600, undefined, 'bandpass');
  }

  /** Pop bumper — the signature "boing", pitched by how many you've strung together. */
  bumper(chain: number): void {
    const f = 260 * Math.pow(2, Math.min(chain, 14) / 14);
    this.tone(f, 0.16, { type: 'square', vol: 0.16, slideTo: f * 2.1 });
    this.tone(f * 1.5, 0.11, { type: 'sine', vol: 0.11, slideTo: f * 3 });
    this.noise(0.05, 0.09, 3200);
  }

  sling(): void {
    this.tone(420, 0.1, { type: 'sawtooth', vol: 0.13, slideTo: 780 });
    this.noise(0.05, 0.1, 2400);
  }

  target(n: number): void {
    const f = 520 * Math.pow(2, Math.min(n, 6) / 8);
    this.tone(f, 0.11, { type: 'square', vol: 0.15, slideTo: f * 1.4 });
    this.tone(f * 2, 0.07, { type: 'sine', vol: 0.09 });
  }

  bankClear(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.18, { type: 'square', vol: 0.15, when: t + i * 0.075 });
      this.tone(f * 2, 0.12, { type: 'sine', vol: 0.08, when: t + i * 0.075 });
    });
  }

  rollover(): void {
    this.tone(880, 0.09, { type: 'sine', vol: 0.14, slideTo: 1320 });
    this.tone(1320, 0.07, { type: 'triangle', vol: 0.08 });
  }

  spinner(n: number): void {
    const f = 600 + (n % 8) * 90;
    this.tone(f, 0.045, { type: 'square', vol: 0.075 });
  }

  plungerCharge(power: number): void {
    this.tone(60 + power * 90, 0.06, { type: 'sawtooth', vol: 0.05 });
  }

  launch(power: number): void {
    this.tone(120, 0.28, { type: 'sawtooth', vol: 0.16, slideTo: 320 + power * 620 });
    this.noise(0.16, 0.13, 1400);
  }

  /** Outlane kickback — a solenoid thump then a rising whoosh. */
  kickback(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(70, 0.12, { type: 'square', vol: 0.24, slideTo: 40, when: t });
    this.noise(0.1, 0.2, 1200, t);
    this.tone(240, 0.3, { type: 'sawtooth', vol: 0.15, slideTo: 900, when: t + 0.02 });
    this.tone(480, 0.22, { type: 'triangle', vol: 0.1, slideTo: 1400, when: t + 0.04 });
  }

  saucer(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 7; i++) {
      this.tone(300 + i * 190, 0.16, { type: 'sine', vol: 0.11, when: t + i * 0.045, slideTo: 500 + i * 260 });
    }
    this.noise(0.4, 0.1, 900, t);
  }

  jackpot(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const seq: [number, number][] = [
      [659.25, 0], [783.99, 0.09], [1046.5, 0.18], [1318.5, 0.27], [1567.98, 0.4],
    ];
    for (const [f, dt] of seq) {
      this.tone(f, 0.3, { type: 'square', vol: 0.15, when: t + dt });
      this.tone(f / 2, 0.3, { type: 'triangle', vol: 0.1, when: t + dt });
    }
  }

  multiball(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 12; i++) {
      this.tone(220 * Math.pow(2, i / 12), 0.2, { type: 'sawtooth', vol: 0.1, when: t + i * 0.055 });
    }
    this.noise(0.7, 0.12, 2600, t);
  }

  ballSaved(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 523.25, 659.25].forEach((f, i) => {
      this.tone(f, 0.2, { type: 'triangle', vol: 0.16, when: t + i * 0.07 });
    });
  }

  drain(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(300, 0.55, { type: 'sawtooth', vol: 0.17, slideTo: 55, when: t });
    this.tone(150, 0.65, { type: 'square', vol: 0.1, slideTo: 40, when: t + 0.04 });
    this.noise(0.3, 0.1, 700, t);
  }

  gameOver(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 349.23, 311.13, 261.63].forEach((f, i) => {
      this.tone(f, 0.45, { type: 'square', vol: 0.14, when: t + i * 0.28 });
      this.tone(f / 2, 0.45, { type: 'triangle', vol: 0.11, when: t + i * 0.28 });
    });
  }

  highScore(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const seq: [number, number][] = [
      [523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36],
      [880, 0.54], [1046.5, 0.66], [1318.5, 0.82], [1567.98, 1.0],
    ];
    for (const [f, dt] of seq) {
      this.tone(f, 0.34, { type: 'square', vol: 0.15, when: t + dt });
      this.tone(f / 2, 0.34, { type: 'triangle', vol: 0.1, when: t + dt });
    }
  }

  // ---- ambient bed --------------------------------------------------------
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    const bass = [65.41, 65.41, 98.0, 65.41, 87.31, 87.31, 58.27, 77.78];
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const dur = 0.26;
      while (this.nextNote < this.ctx.currentTime + 0.35) {
        const i = this.step;
        const f = bass[Math.floor(i / 2) % bass.length];
        const vol = this.playing ? 0.13 : 0.07;
        this.tone(f, dur * 0.9, {
          type: 'sawtooth', vol, dest: this.musicGain,
          when: this.nextNote, attack: 0.012,
        });
        if (this.playing && (i % 2 === 0 || this.intensity > 0.45)) {
          this.tone(f * (i % 4 === 0 ? 8 : this.intensity > 0.7 ? 12 : 6), 0.1, {
            type: 'triangle',
            vol: 0.03 + this.intensity * 0.045,
            dest: this.musicGain,
            when: this.nextNote,
          });
        }
        this.nextNote += dur;
        this.step++;
      }
      this.musicTimer = window.setTimeout(tick, 120);
    };
    tick();
  }
}

export const audio = new SynthAudio();
