export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.buffer = null;
    this.startTime = 0;
    this.playing = false;
    this.paused = false;
    this.pauseTime = 0;
    this.onEnded = null;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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

  play() {
    if (!this.buffer || !this.ctx) return;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);
    this.source.onended = () => {
      if (this.playing && !this.paused) {
        this.playing = false;
        if (this.onEnded) this.onEnded();
      }
    };
    this.startTime = this.ctx.currentTime;
    this.source.start(0);
    this.playing = true;
    this.paused = false;
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.pauseTime = this.getCurrentTime();
    try { this.source.stop(); } catch (e) { /* already stopped */ }
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);
    this.source.onended = () => {
      if (this.playing && !this.paused) {
        this.playing = false;
        if (this.onEnded) this.onEnded();
      }
    };
    this.startTime = this.ctx.currentTime - this.pauseTime;
    this.source.start(0, this.pauseTime);
    this.paused = false;
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch (e) { /* already stopped */ }
    }
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
