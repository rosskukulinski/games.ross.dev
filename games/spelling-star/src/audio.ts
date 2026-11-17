// Synthesized sound effects (no audio files). Unlocked on first gesture.

const MUTE_KEY = 'spelling-star-muted';
// Major pentatonic — every letter note sounds good next to the last one.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private note(step: number, base = 523.25): number {
    const oct = Math.floor(step / PENTA.length);
    const semis = PENTA[step % PENTA.length] + oct * 36;
    return base * Math.pow(2, semis / 12);
  }

  /** Correct letter. Pitch climbs through the word and with the streak. */
  letter(index: number, streak: number): void {
    const f = this.note(index + Math.min(streak, 5));
    this.tone(f, 0.18, 'triangle', 0.32);
    this.tone(f * 2, 0.1, 'sine', 0.08, 0.01);
  }

  wrong(): void {
    this.tone(220, 0.16, 'square', 0.07, 0, 160);
    this.tone(175, 0.2, 'triangle', 0.18, 0.06, 140);
  }

  tap(): void {
    this.tone(880, 0.05, 'sine', 0.12);
  }

  hint(): void {
    this.tone(660, 0.12, 'sine', 0.18);
    this.tone(990, 0.16, 'sine', 0.12, 0.08);
  }

  word(stars: number, streak: number): void {
    const lift = Math.min(streak, 6);
    const steps = stars === 3 ? [0, 2, 4, 5, 7] : stars === 2 ? [0, 2, 4, 5] : [0, 2, 4];
    steps.forEach((s, i) => {
      this.tone(this.note(s + lift), 0.32, 'triangle', 0.28, i * 0.075);
      this.tone(this.note(s + lift) * 2, 0.2, 'sine', 0.07, i * 0.075 + 0.01);
    });
    // sparkle tail
    for (let i = 0; i < 6; i++) this.tone(1800 + Math.random() * 1600, 0.08, 'sine', 0.04, 0.35 + i * 0.045);
  }

  starLand(): void {
    this.tone(1318, 0.25, 'sine', 0.16);
    this.tone(1975, 0.3, 'sine', 0.08, 0.04);
  }

  fanfare(): void {
    const seq = [0, 2, 4, 7, 4, 7, 10];
    seq.forEach((s, i) => this.tone(this.note(s, 392), 0.4, 'triangle', 0.26, i * 0.12));
    [0, 4, 7].forEach((s) => this.tone(this.note(s + 7, 392), 1.2, 'sine', 0.12, seq.length * 0.12));
  }
}

export const sfx = new Sfx();
