/**
 * All-synth Web Audio: no files. Context is created lazily on the first
 * user gesture (ensure()). Includes a continuous wing-whoosh loop whose
 * gain/filter track flight speed.
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private whooshGain: GainNode | null = null
  private whooshFilter: BiquadFilterNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  muted = false

  /** Create/resume the context. Must be called from a user gesture. */
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
      this.noiseBuffer = this.makeNoise()
      this.startWhoosh()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.015)
    }
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private tone(
    freq: number,
    delay: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    sweepTo?: number
  ): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t + dur)
    }
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.06)
  }

  private noise(
    delay: number,
    dur: number,
    vol: number,
    filterType: BiquadFilterType,
    freqFrom: number,
    freqTo: number,
    q = 1
  ): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.Q.value = q
    filter.frequency.setValueAtTime(freqFrom, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 10), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  /** Continuous flight whoosh; call setSpeed each frame with 0..1. */
  private startWhoosh(): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    this.whooshFilter = this.ctx.createBiquadFilter()
    this.whooshFilter.type = 'bandpass'
    this.whooshFilter.frequency.value = 300
    this.whooshFilter.Q.value = 0.7
    this.whooshGain = this.ctx.createGain()
    this.whooshGain.gain.value = 0
    src.connect(this.whooshFilter)
    this.whooshFilter.connect(this.whooshGain)
    this.whooshGain.connect(this.master)
    src.start()
  }

  setSpeed(ratio: number): void {
    if (!this.ctx || !this.whooshGain || !this.whooshFilter) return
    const t = this.ctx.currentTime
    this.whooshGain.gain.setTargetAtTime(ratio * ratio * 0.12, t, 0.1)
    this.whooshFilter.frequency.setTargetAtTime(220 + ratio * 700, t, 0.1)
  }

  /** Magic bolt zap. */
  shoot(): void {
    this.tone(880, 0, 0.12, 'square', 0.05, 220)
    this.tone(1760, 0, 0.08, 'sawtooth', 0.03, 440)
  }

  /** Bolt connects with a dragon. */
  hit(): void {
    this.noise(0, 0.12, 0.14, 'lowpass', 900, 200)
    this.tone(200, 0, 0.1, 'triangle', 0.1, 90)
  }

  /** Dragon roar: filtered noise sweep + low growl. */
  roar(): void {
    this.noise(0, 0.7, 0.16, 'bandpass', 140, 500, 2.5)
    this.tone(90, 0, 0.65, 'sawtooth', 0.09, 55)
    this.tone(135, 0.05, 0.5, 'square', 0.04, 70)
  }

  /** Dragon defeated fanfare. */
  kill(): void {
    this.noise(0, 0.4, 0.2, 'lowpass', 1400, 120)
    this.tone(523, 0.05, 0.14, 'triangle', 0.14)
    this.tone(659, 0.15, 0.14, 'triangle', 0.14)
    this.tone(784, 0.25, 0.26, 'triangle', 0.16)
  }

  /** Trick complete: sparkly rising arpeggio. */
  trick(combo: number): void {
    const base = 523.25 * Math.pow(1.05946, Math.min(Math.floor(combo * 2), 12))
    this.tone(base, 0, 0.12, 'sine', 0.16)
    this.tone(base * 1.26, 0.07, 0.12, 'sine', 0.15)
    this.tone(base * 1.5, 0.14, 0.12, 'sine', 0.14)
    this.tone(base * 2, 0.21, 0.3, 'triangle', 0.15)
  }

  /** Player takes a hit. */
  playerHit(): void {
    this.noise(0, 0.25, 0.22, 'lowpass', 500, 90)
    this.tone(140, 0, 0.2, 'sawtooth', 0.1, 60)
  }

  /** Mount switch chime. */
  switchMount(): void {
    this.tone(660, 0, 0.1, 'sine', 0.12)
    this.tone(990, 0.06, 0.16, 'sine', 0.1)
  }

  gameOver(): void {
    this.tone(392, 0, 0.3, 'triangle', 0.16)
    this.tone(311, 0.28, 0.3, 'triangle', 0.15)
    this.tone(233, 0.56, 0.6, 'triangle', 0.15)
    this.noise(0.5, 1.0, 0.08, 'lowpass', 400, 60)
  }
}
