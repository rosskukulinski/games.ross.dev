class AudioManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = true;
    }

    // Create a simple oscillator-based sound
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.initialized) this.init();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Collision/hit sound - harsh buzz
    playCollision() {
        this.playTone(150, 0.15, 'sawtooth', 0.4);
        setTimeout(() => this.playTone(100, 0.1, 'square', 0.3), 50);
    }

    // Boost/ramp sound - rising tone
    playBoost() {
        this.playTone(300, 0.1, 'sine', 0.3);
        setTimeout(() => this.playTone(400, 0.1, 'sine', 0.3), 80);
        setTimeout(() => this.playTone(500, 0.15, 'sine', 0.3), 160);
    }

    // Wind sound - white noise burst
    playWind() {
        if (!this.initialized) this.init();

        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        noise.start();
    }

    // Win fanfare - happy ascending tones
    playWin() {
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.3), i * 150);
        });
    }

    // Game over sound - descending sad tones
    playGameOver() {
        const notes = [400, 350, 300, 200];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.25, 'triangle', 0.3), i * 200);
        });
    }

    // Lane change sound - quick blip
    playLaneChange() {
        this.playTone(440, 0.05, 'sine', 0.2);
    }
}
