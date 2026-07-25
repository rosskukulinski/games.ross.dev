/** All-synth audio: no files, everything generated with the Web Audio API. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Create/resume the context. Must be called from a user gesture. */
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.4, this.ctx.currentTime, 0.015);
    }
  }

  private tone(
    freq: number,
    delay: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    sweepTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t + dur);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  /** Rising sparkle arpeggio; pitch climbs a semitone per orb collected. */
  collect(orbIndex: number): void {
    const base = 523.25 * Math.pow(1.05946, Math.min(orbIndex, 14));
    this.tone(base, 0, 0.16, 'sine', 0.22);
    this.tone(base * 1.335, 0.055, 0.18, 'sine', 0.18);
    this.tone(base * 2, 0.11, 0.3, 'triangle', 0.16);
    this.tone(base * 2.997, 0.11, 0.22, 'sine', 0.06);
  }

  jump(): void {
    this.tone(280, 0, 0.16, 'sine', 0.1, 560);
  }

  boing(): void {
    this.tone(130, 0, 0.32, 'sine', 0.24, 820);
    this.tone(65, 0, 0.3, 'triangle', 0.16, 410);
  }

  land(): void {
    this.tone(120, 0, 0.07, 'triangle', 0.08, 60);
  }

  footstep(alt: boolean): void {
    this.tone(alt ? 95 : 85, 0, 0.045, 'triangle', 0.05, 55);
  }

  fanfare(): void {
    const seq: Array<[number, number, number]> = [
      [523.25, 0.0, 0.22],
      [659.26, 0.13, 0.22],
      [783.99, 0.26, 0.22],
      [1046.5, 0.39, 0.5],
      [783.99, 0.62, 0.16],
      [1046.5, 0.75, 0.8],
      [1318.5, 0.75, 0.8],
    ];
    for (const [f, d, len] of seq) {
      this.tone(f, d, len, 'triangle', 0.18);
      this.tone(f / 2, d, len, 'sine', 0.1);
    }
  }

  timeUp(): void {
    this.tone(392, 0, 0.28, 'triangle', 0.16);
    this.tone(329.6, 0.24, 0.3, 'triangle', 0.16);
    this.tone(261.6, 0.5, 0.55, 'triangle', 0.18);
  }
}
