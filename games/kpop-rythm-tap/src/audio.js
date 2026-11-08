export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.source = null;
    this.buffer = null;
    this.startTime = 0;
    this.playing = false;
    this.paused = false;
    this.pauseTime = 0;
    this.onEnded = null;
    this.fadeTimer = null;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async load(url) {
    await this.init();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
    return this.buffer.duration;
  }

  // Start the buffer so that song time `from` is "now". A negative `from` is a
  // silent pre-roll: the clock runs (negative) and the music starts at 0.
  _startSource(from) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    src.onended = () => {
      // ignore sources we already replaced or stopped on purpose
      if (this.source === src && this.playing && !this.paused) {
        this.playing = false;
        if (this.onEnded) this.onEnded();
      }
    };
    const now = this.ctx.currentTime;
    if (from < 0) src.start(now - from, 0);
    else src.start(now, from);
    this.source = src;
    this.startTime = now - from;
  }

  _stopSource() {
    if (this.source) {
      try { this.source.stop(); } catch (e) { /* already stopped */ }
    }
  }

  _cancelFade() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    if (this.gain) {
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gain.gain.setValueAtTime(1, this.ctx.currentTime);
    }
  }

  play(from = 0) {
    if (!this.buffer || !this.ctx) return;
    this._cancelFade();
    this._stopSource();
    this._startSource(from);
    this.playing = true;
    this.paused = false;
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.pauseTime = this.getCurrentTime();
    this._stopSource();
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    // the context can be suspended by the OS (iOS interruptions, background
    // tabs); its clock is frozen until it runs again
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this._startSource(this.pauseTime);
    this.paused = false;
  }

  // Fade the music out, then stop. A later play() cancels the pending stop.
  fadeOutAndStop(sec = 1.5) {
    if (!this.ctx || !this.playing || this.paused) {
      this.stop();
      return;
    }
    const g = this.gain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + sec);
    this.playing = false; // onEnded must not fire for a deliberate ending
    this.paused = false;
    this.fadeTimer = setTimeout(() => {
      this.fadeTimer = null;
      this._stopSource();
    }, sec * 1000 + 50);
  }

  stop() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this._stopSource();
    this.playing = false;
    this.paused = false;
  }

  getCurrentTime() {
    if (!this.playing) return 0;
    if (this.paused) return this.pauseTime;
    return this.ctx.currentTime - this.startTime;
  }

  getDuration() {
    return this.buffer ? this.buffer.duration : 0;
  }
}
