/**
 * Web Audio synth — sunny edition. No audio files: oscillators, filtered
 * noise, and gentle randomized birdsong. Unlocked on first user gesture.
 */

class SunnyAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  muted = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.5;
      this.ambientGain.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.2;
      this.musicGain.connect(this.master);

      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.startBreeze();
      this.startBirds();
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

  // -- primitives -----------------------------------------------------------

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
    osc.type = opts.type ?? 'sine';
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

  private noise(
    dur: number,
    vol: number,
    filterFreq: number,
    opts: { type?: BiquadFilterType; q?: number; when?: number; slideTo?: number } = {},
  ): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf) return;
    const t0 = opts.when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = opts.type ?? 'lowpass';
    filt.frequency.setValueAtTime(filterFreq, t0);
    if (opts.slideTo) filt.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
    if (opts.q !== undefined) filt.Q.value = opts.q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // -- game sounds ----------------------------------------------------------

  /** Balloon pop — snappy noise burst + blip, pitch rises with combo. */
  pop(combo: number): void {
    const step = Math.min(combo, 16);
    const f = 500 * Math.pow(2, step / 12);
    this.noise(0.09, 0.32, 2600 + step * 220, { type: 'bandpass', q: 0.9 });
    this.tone(f, 0.1, { type: 'sine', vol: 0.16, slideTo: f * 1.8 });
    this.tone(f * 2, 0.05, { type: 'triangle', vol: 0.08 });
  }

  /** Golden balloon — bright little fanfare. */
  golden(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
      this.tone(f, 0.22, { type: 'triangle', vol: 0.16, when: t + i * 0.07 });
      this.tone(f * 2, 0.14, { type: 'sine', vol: 0.07, when: t + i * 0.07 });
    });
    this.noise(0.5, 0.1, 6000, { type: 'highpass', when: t });
  }

  /** Rainbow balloon — quick sparkling glissando. */
  rainbow(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      this.tone(f, 0.14, { type: 'sine', vol: 0.12, when: t + i * 0.045 });
    });
  }

  /** Bomb — soft womp + rumble; startling-free for young kids. */
  bomb(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(180, 0.5, { type: 'sawtooth', vol: 0.16, slideTo: 42, when: t });
    this.tone(90, 0.6, { type: 'sine', vol: 0.2, slideTo: 30, when: t + 0.02 });
    this.noise(0.55, 0.18, 300, { slideTo: 60, when: t });
  }

  /** Slow-motion power-up — dreamy downward whoosh. */
  slowmo(): void {
    this.tone(880, 0.6, { type: 'sine', vol: 0.12, slideTo: 220 });
    this.noise(0.55, 0.08, 2400, { slideTo: 300 });
  }

  /** A heart floats away — gentle two-note "aww". */
  lifeLost(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(392, 0.25, { type: 'triangle', vol: 0.14, when: t });
    this.tone(311, 0.4, { type: 'triangle', vol: 0.14, when: t + 0.18 });
  }

  gameOver(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 466.16, 392, 329.63].forEach((f, i) => {
      this.tone(f, 0.35, { type: 'triangle', vol: 0.13, when: t + i * 0.22 });
      this.tone(f / 2, 0.4, { type: 'sine', vol: 0.1, when: t + i * 0.22 });
    });
  }

  start(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone(f, 0.18, { type: 'triangle', vol: 0.14, when: t + i * 0.08 });
    });
  }

  click(): void {
    this.tone(660, 0.06, { type: 'sine', vol: 0.1, slideTo: 880 });
  }

  // -- ambience ---------------------------------------------------------------

  /** Very quiet, slowly-breathing filtered noise = summer breeze. */
  private startBreeze(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 480;
    const g = this.ctx.createGain();
    g.gain.value = 0.03;
    // slow LFO on filter freq for that "wind in the trees" swell
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoAmt = this.ctx.createGain();
    lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt);
    lfoAmt.connect(filt.frequency);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.ambientGain);
    src.start();
    lfo.start();
  }

  /** Occasional randomized bird chirps. */
  private chirp(when: number, base: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t0 = when + i * (0.09 + Math.random() * 0.06);
      const f = base * (1 + Math.random() * 0.25);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * (1.3 + Math.random() * 0.4), t0 + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + 0.1);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.connect(g);
      g.connect(this.ambientGain);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    }
  }

  private startBirds(): void {
    const loop = () => {
      if (this.ctx) {
        this.chirp(this.ctx.currentTime + Math.random() * 0.5, 1900 + Math.random() * 1600);
      }
      window.setTimeout(loop, 3500 + Math.random() * 6500);
    };
    window.setTimeout(loop, 2000);
  }

  /** Soft plucked pentatonic loop — barely-there summer music box. */
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.5;
    this.noteIndex = 0;
    // C major pentatonic wander, long gaps — a lazy afternoon feel
    const melody = [523.25, 587.33, 659.25, 783.99, 659.25, 880, 783.99, 587.33];
    const schedule = () => {
      if (!this.ctx || !this.musicGain) return;
      const stepDur = 0.62;
      while (this.nextNoteTime < this.ctx.currentTime + 0.6) {
        const i = this.noteIndex % melody.length;
        // skip some notes so it feels improvised, not looping
        if (Math.random() > 0.3) {
          const f = melody[i] * (Math.random() < 0.12 ? 0.5 : 1);
          this.tone(f, 0.9, {
            type: 'sine',
            vol: 0.1,
            dest: this.musicGain,
            when: this.nextNoteTime,
            attack: 0.006,
          });
          this.tone(f * 2, 0.4, {
            type: 'sine',
            vol: 0.03,
            dest: this.musicGain,
            when: this.nextNoteTime,
          });
        }
        this.nextNoteTime += stepDur;
        this.noteIndex++;
      }
      this.musicTimer = window.setTimeout(schedule, 200);
    };
    schedule();
  }
}

export const audio = new SunnyAudio();
