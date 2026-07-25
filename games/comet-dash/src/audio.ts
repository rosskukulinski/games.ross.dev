/**
 * All game audio is synthesized with the Web Audio API — no external files.
 * The AudioContext is only created after the first user interaction.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padTimer: number | null = null;
  private padStep = 0;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem("cometDash.muted") === "1";
  }

  /** Create the AudioContext (must be triggered by a user gesture). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.startPad();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem("cometDash.muted", m ? "1" : "0");
    if (this.ctx && this.master) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.55, this.ctx.currentTime + 0.15);
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  // ---------- individual sounds ----------

  /** Quick filtered-noise whoosh for lane changes. */
  whoosh(dir: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const dur = 0.22;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 1.4;
    filt.frequency.setValueAtTime(dir > 0 ? 500 : 1400, t);
    filt.frequency.exponentialRampToValueAtTime(dir > 0 ? 1600 : 450, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  /** Rising sweep for jumps. */
  jump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.24);
  }

  /** Sparkly ascending chime; pitch rises with pickup combo. */
  pickup(combo: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const base = 660 * Math.pow(1.0595, Math.min(combo, 12)); // up a semitone per combo
    const notes = [base, base * 1.25, base * 1.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 0.3);
    });
  }

  /** Big layered boom for the crash. */
  crash(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    // low sine drop
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.7);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.85);

    // noise blast
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.9);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(5000, t);
    filt.frequency.exponentialRampToValueAtTime(120, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.9);
  }

  // ---------- ambient pad ----------

  private startPad(): void {
    if (this.padTimer !== null) return;
    const play = () => this.padChord();
    play();
    this.padTimer = window.setInterval(play, 4200);
  }

  private padChord(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || document.hidden) return;
    // gentle i - VI - III - VII progression in B minor-ish space
    const chords = [
      [123.47, 185.0, 246.94, 293.66],
      [98.0, 146.83, 196.0, 246.94],
      [110.0, 164.81, 220.0, 277.18],
      [130.81, 196.0, 261.63, 329.63],
    ];
    const notes = chords[this.padStep % chords.length];
    this.padStep++;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 620;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.linearRampToValueAtTime(0.055, t + 1.6);
    cg.gain.linearRampToValueAtTime(0.0001, t + 4.4);
    lp.connect(cg).connect(this.master);
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 5;
      o.connect(lp);
      o.start(t);
      o.stop(t + 4.5);
    });
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
