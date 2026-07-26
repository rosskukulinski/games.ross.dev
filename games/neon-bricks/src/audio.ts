/** Web Audio synth — no audio files. Everything is oscillators + noise. */

class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  muted = false;
  /** 0..1 — raises ambient intensity with combo */
  intensity = 0;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      // white-noise buffer for percussive sounds
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      vol?: number;
      slideTo?: number;
      attack?: number;
      dest?: GainNode | null;
      when?: number;
    } = {},
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = opts.when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    const vol = opts.vol ?? 0.2;
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, when?: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf) return;
    const t0 = when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** Brick hit — pitch rises with combo. */
  brickHit(combo: number): void {
    const step = Math.min(combo, 24);
    const freq = 340 * Math.pow(2, step / 12);
    this.tone(freq, 0.09, { type: 'square', vol: 0.14 });
    this.tone(freq * 2, 0.06, { type: 'sine', vol: 0.1 });
  }

  brickBreak(combo: number): void {
    const step = Math.min(combo, 24);
    const freq = 420 * Math.pow(2, step / 12);
    this.tone(freq, 0.14, { type: 'square', vol: 0.16, slideTo: freq * 1.5 });
    this.tone(freq * 1.5, 0.1, { type: 'triangle', vol: 0.12 });
    this.noise(0.08, 0.12, 3500);
  }

  paddleHit(): void {
    this.tone(180, 0.08, { type: 'triangle', vol: 0.3, slideTo: 120 });
    this.noise(0.04, 0.1, 900);
  }

  wallHit(): void {
    this.tone(240, 0.05, { type: 'sine', vol: 0.12, slideTo: 200 });
  }

  launch(): void {
    this.tone(220, 0.18, { type: 'sawtooth', vol: 0.14, slideTo: 660 });
  }

  laser(): void {
    this.tone(1400, 0.12, { type: 'sawtooth', vol: 0.1, slideTo: 240 });
  }

  powerUp(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.14, { type: 'square', vol: 0.14, when: t + i * 0.07 });
      this.tone(f * 2, 0.1, { type: 'sine', vol: 0.07, when: t + i * 0.07 });
    });
  }

  lifeLost(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(320, 0.5, { type: 'sawtooth', vol: 0.2, slideTo: 60, when: t });
    this.tone(160, 0.6, { type: 'square', vol: 0.12, slideTo: 40, when: t + 0.05 });
  }

  gameOver(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 370, 349, 330].forEach((f, i) => {
      this.tone(f, 0.4, { type: 'square', vol: 0.14, when: t + i * 0.3 });
      this.tone(f / 2, 0.4, { type: 'triangle', vol: 0.12, when: t + i * 0.3 });
    });
  }

  levelClear(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, 0.2, { type: 'square', vol: 0.13, when: t + i * 0.09 });
    });
  }

  winFanfare(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const seq: [number, number][] = [
      [523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42],
      [783.99, 0.62], [1046.5, 0.76], [1318.5, 1.0],
    ];
    for (const [f, dt] of seq) {
      this.tone(f, 0.32, { type: 'square', vol: 0.15, when: t + dt });
      this.tone(f / 2, 0.32, { type: 'triangle', vol: 0.1, when: t + dt });
    }
  }

  // ---- ambient synthwave loop -------------------------------------------
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.noteIndex = 0;
    const schedule = () => {
      if (!this.ctx || !this.musicGain) return;
      const bassline = [55, 55, 82.4, 55, 65.4, 65.4, 49, 61.7]; // A A E A C C G B
      const stepDur = 0.24;
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        const i = this.noteIndex % (bassline.length * 2);
        const bassIdx = Math.floor(i / 2) % bassline.length;
        const f = bassline[bassIdx];
        // bass pulse on every step
        this.tone(f, stepDur * 0.92, {
          type: 'sawtooth',
          vol: 0.16,
          dest: this.musicGain,
          when: this.nextNoteTime,
          attack: 0.01,
        });
        // hi shimmer arpeggio — denser when intensity high
        if (i % 2 === 0 || this.intensity > 0.4) {
          const arp = f * (i % 4 === 0 ? 8 : this.intensity > 0.7 ? 12 : 6);
          this.tone(arp, 0.1, {
            type: 'triangle',
            vol: 0.04 + this.intensity * 0.05,
            dest: this.musicGain,
            when: this.nextNoteTime,
          });
        }
        this.nextNoteTime += stepDur;
        this.noteIndex++;
      }
      this.musicTimer = window.setTimeout(schedule, 120);
    };
    schedule();
  }
}

export const audio = new SynthAudio();
