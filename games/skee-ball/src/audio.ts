/**
 * Everything is synthesized with the Web Audio API — no sample files, no
 * network requests. The AudioContext is created lazily on the first gesture.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private roll: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem("skeeBall.muted") === "1";
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture. */
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
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.startHum();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem("skeeBall.muted", m ? "1" : "0");
    if (this.ctx && this.master) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.6, this.ctx.currentTime + 0.12);
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  // ---------- continuous layers ----------

  /** Low arcade room tone: two detuned saws through a heavy lowpass. */
  private startHum(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.hum) return;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    lp.Q.value = 0.6;
    const oscs: OscillatorNode[] = [];
    for (const [f, type] of [
      [55, "sawtooth"],
      [82.4, "triangle"],
      [110.3, "sine"],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(lp);
      o.start();
      oscs.push(o);
    }
    lp.connect(g).connect(this.master);
    this.hum = { osc: oscs, gain: g };
  }

  /** Start the rolling rumble (looped filtered noise). */
  startRoll(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.roll) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.roll = { src, filter, gain };
  }

  /** speed01: 0..1 normalized ball speed. */
  updateRoll(speed01: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.roll) return;
    const s = Math.max(0, Math.min(1, speed01));
    this.roll.gain.gain.setTargetAtTime(0.02 + s * 0.3, ctx.currentTime, 0.05);
    this.roll.filter.frequency.setTargetAtTime(260 + s * 1500, ctx.currentTime, 0.05);
  }

  stopRoll(): void {
    const ctx = this.ctx;
    if (!ctx || !this.roll) return;
    const r = this.roll;
    this.roll = null;
    r.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
    window.setTimeout(() => {
      try {
        r.src.stop();
      } catch {
        /* already stopped */
      }
    }, 320);
  }

  // ---------- one-shots ----------

  /** Wooden knock when the ball crests the hump or clips a rail. */
  thunk(strength = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(72, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);

    // woody click transient
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1300;
    bp.Q.value = 2.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.22 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp).connect(ng).connect(this.master);
    src.start(t);
    src.stop(t + 0.1);
  }

  /** Scoring ding — pitch scales with the ring value. */
  ding(points: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const base = 330 + points * 5.2;
    [1, 1.5, 2].forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      const t0 = t + i * 0.012;
      const peak = 0.24 / (i + 1.4);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 0.6);
    });
  }

  /** Sad little thud for a gutter / miss. */
  miss(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  /** Big ticket-spitting fanfare for the 100-point pockets. */
  fanfare(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t0 = t + i * 0.085;
      [1, 2].forEach((m, k) => {
        const o = ctx.createOscillator();
        o.type = k === 0 ? "square" : "sine";
        o.frequency.value = f * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(k === 0 ? 0.12 : 0.16, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
        o.connect(g).connect(this.master!);
        o.start(t0);
        o.stop(t0 + 0.45);
      });
    });
    // ticket chatter
    for (let i = 0; i < 12; i++) {
      const t0 = t + 0.1 + i * 0.045;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2600 + Math.random() * 900;
      bp.Q.value = 5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.06);
    }
  }

  /** Rising whoosh while the power meter charges. */
  charge(power01: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 300 + power01 * 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** End-of-game jingle. */
  gameOver(newBest: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const seq = newBest
      ? [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5]
      : [523.25, 440, 392, 349.23];
    const t = ctx.currentTime;
    seq.forEach((f, i) => {
      const t0 = t + i * 0.14;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 0.52);
    });
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    if (seconds === 2 && this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (seconds === 2) this.noise = buf;
    return buf;
  }
}
