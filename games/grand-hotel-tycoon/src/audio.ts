/**
 * Every sound is synthesized with the Web Audio API — no audio files.
 * The AudioContext is only created after a user gesture.
 */
import { MUTE_KEY } from "./config";

const MASTER_VOL = 0.5;

/** Pentatonic scale (C major pentatonic, two octaves) — everything is in key,
 *  so layered random sounds never clash. */
const PENTA = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private sea: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  /** 0..1 — how busy the resort is. Drives musical density. */
  intensity = 0;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.3;
    this.music.connect(this.master);

    this.sea = this.ctx.createGain();
    this.sea.gain.value = 0.16;
    this.sea.connect(this.master);

    const len = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.startMusic();
    this.startSurf();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    if (this.ctx && this.master) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : MASTER_VOL, this.ctx.currentTime + 0.15);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /* ------------------------------------------------------------ primitives */

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
      detune?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const dest = opts.dest ?? this.sfx;
    if (!dest) return;
    const t0 = opts.when ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? "triangle";
    o.frequency.setValueAtTime(freq, t0);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    }
    const vol = opts.vol ?? 0.2;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.04);
  }

  /** Struck-marimba voice — a sine with a fast pitch blip and a wooden knock. */
  private mallet(freq: number, vol = 0.18, when?: number, dest?: GainNode | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = when ?? ctx.currentTime;
    this.tone(freq, 0.42, { type: "sine", vol, when: t0, dest: dest ?? this.sfx, attack: 0.003 });
    this.tone(freq * 2.01, 0.13, {
      type: "sine",
      vol: vol * 0.4,
      when: t0,
      dest: dest ?? this.sfx,
    });
    this.noise(0.03, vol * 0.35, 2200, t0, dest ?? this.sfx);
  }

  private noise(
    dur: number,
    vol: number,
    filterFreq: number,
    when?: number,
    dest?: GainNode | null,
    type: BiquadFilterType = "lowpass",
  ): void {
    const ctx = this.ctx;
    const target = dest ?? this.sfx;
    if (!ctx || !this.noiseBuf || !target) return;
    const t0 = when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(target);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ----------------------------------------------------------------- sfx */

  /** Reception desk bell. */
  deskBell(): void {
    const t = this.ctx?.currentTime ?? 0;
    this.tone(1318.5, 0.7, { type: "sine", vol: 0.16, when: t });
    this.tone(1975.5, 0.5, { type: "sine", vol: 0.08, when: t + 0.005 });
    this.noise(0.04, 0.07, 6000, t, this.sfx, "highpass");
  }

  /** Coin scooped up — climbs the pentatonic scale with the pickup streak. */
  coin(streak: number): void {
    const i = Math.min(streak, PENTA.length - 1);
    this.mallet(PENTA[i] * 2, 0.13);
  }

  /** Cash dropped into the safe. */
  deposit(amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = Math.min(6, 2 + Math.floor(amount / 60));
    for (let i = 0; i < n; i++) {
      this.mallet(PENTA[3 + (i % 5)] * 2, 0.1, t + i * 0.045);
    }
    // register clunk
    this.tone(140, 0.16, { type: "square", vol: 0.14, slideTo: 90, when: t });
    this.noise(0.09, 0.1, 1400, t + 0.02);
  }

  /** Progress ring filling — a soft repeating tick. */
  workTick(progress: number): void {
    this.tone(420 + progress * 380, 0.05, { type: "sine", vol: 0.05 });
  }

  /** Room scrubbed clean. */
  sparkle(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [7, 8, 9, 10].forEach((n, i) => this.mallet(PENTA[n], 0.1, t + i * 0.05));
    this.noise(0.22, 0.06, 5200, t, this.sfx, "highpass");
  }

  /** Guest checks out happy. */
  happy(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [4, 6, 8].forEach((n, i) => this.mallet(PENTA[n], 0.11, t + i * 0.07));
  }

  /** Guest gave up and walked out — sad, but gentle. Never harsh for a kid. */
  walkout(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(330, 0.3, { type: "triangle", vol: 0.13, slideTo: 220, when: t });
    this.tone(247, 0.36, { type: "sine", vol: 0.1, when: t + 0.13, slideTo: 165 });
  }

  /** Coins draining into a build pad — pitch climbs with completion. */
  drain(progress: number): void {
    this.tone(300 + progress * 700, 0.06, { type: "sawtooth", vol: 0.045 });
  }

  /** Something new got built. The biggest sound in the game. */
  build(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const arp = [0, 2, 4, 5, 7, 9, 10];
    arp.forEach((n, i) => this.mallet(PENTA[n] * 1.5, 0.15, t + i * 0.055));
    // warm brass-ish swell underneath
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
      this.tone(f, 1.4, {
        type: "triangle",
        vol: 0.09,
        when: t + 0.3,
        attack: 0.12,
        detune: (i - 1.5) * 6,
      });
    });
    this.noise(0.5, 0.1, 3600, t + 0.28, this.sfx, "highpass");
  }

  /** Star rating went up a whole star. */
  starUp(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [5, 7, 9, 10].forEach((n, i) =>
      this.tone(PENTA[n] * 2, 0.5, { type: "sine", vol: 0.12, when: t + i * 0.08 }),
    );
  }

  /** Splash for the pool. */
  splash(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(0.35, 0.14, 2600, t, this.sfx, "bandpass");
    this.tone(680, 0.2, { type: "sine", vol: 0.06, slideTo: 1500, when: t });
  }

  /** Plot expanded — a low, spacious whoomph. */
  expand(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(70, 0.9, { type: "sine", vol: 0.3, slideTo: 150, when: t, attack: 0.05 });
    this.noise(0.8, 0.14, 900, t);
  }

  /** UI blip for buttons. */
  blip(): void {
    this.mallet(PENTA[6], 0.1);
  }

  /* --------------------------------------------------------------- ambient */

  /** Steel-drum-ish loop. Density and shimmer scale with `intensity`. */
  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicTimer !== null) return;
    this.nextNote = ctx.currentTime + 0.15;

    const bass = [65.41, 65.41, 87.31, 98.0, 87.31, 73.42, 65.41, 98.0]; // C C F G F D C G
    const stepDur = 0.34;

    const schedule = () => {
      const c = this.ctx;
      if (!c || !this.music) return;
      while (this.nextNote < c.currentTime + 0.5) {
        const i = this.step;
        const bar = Math.floor(i / 8) % 4;
        const beat = i % 8;

        // bass pulse on every other step
        if (beat % 2 === 0) {
          this.tone(bass[(bar * 2 + beat / 2) % bass.length], stepDur * 1.6, {
            type: "triangle",
            vol: 0.11,
            dest: this.music,
            when: this.nextNote,
            attack: 0.03,
          });
        }

        // marimba melody — sparse when quiet, busy when the resort is humming
        const density = 0.28 + this.intensity * 0.5;
        if (beat === 0 || Math.random() < density) {
          const oct = Math.random() < 0.3 + this.intensity * 0.3 ? 2 : 1;
          const note = PENTA[(bar + beat) % 5 + (beat > 4 ? 3 : 0)] * oct;
          this.mallet(note, 0.055 + this.intensity * 0.045, this.nextNote, this.music);
        }

        // off-beat shaker keeps the groove moving
        if (beat % 2 === 1) {
          this.noise(
            0.05,
            0.02 + this.intensity * 0.025,
            7000,
            this.nextNote,
            this.music,
            "highpass",
          );
        }

        this.nextNote += stepDur;
        this.step++;
      }
      this.musicTimer = window.setTimeout(schedule, 160);
    };
    schedule();
  }

  /** Slow filtered-noise surf, forever. */
  private startSurf(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sea || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 520;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    // LFO swells the surf in and out roughly every 9 s
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.34;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    src.connect(f).connect(g).connect(this.sea);
    src.start();
  }
}

export const audio = new GameAudio();
