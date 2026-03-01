// Audio Module
// Handles sound effects using Web Audio API

const Audio = {
    context: null,
    enabled: true,
    sounds: {},

    init() {
        // Create audio context on user interaction
        this.createContext();
    },

    createContext() {
        if (this.context) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    },

    // Resume context (needed after user interaction)
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    // Generate a correct/success sound
    playCorrect() {
        if (!this.enabled || !this.context) return;
        this.resume();

        // Play ascending notes
        const now = this.context.currentTime;
        this.playTone(523.25, now, 0.15);        // C5
        this.playTone(659.25, now + 0.1, 0.15);  // E5
        this.playTone(783.99, now + 0.2, 0.2);   // G5
    },

    // Generate a timeout/fail sound
    playTimeout() {
        if (!this.enabled || !this.context) return;
        this.resume();

        const now = this.context.currentTime;
        // Descending buzzer
        this.playTone(400, now, 0.3, 'square', 0.2);
        this.playTone(300, now + 0.15, 0.3, 'square', 0.2);
    },

    // Generate a tick sound
    playTick() {
        if (!this.enabled || !this.context) return;
        this.resume();

        // Short click
        this.playTone(800, this.context.currentTime, 0.05, 'sine', 0.1);
    },

    // Play the start game sound
    playStart() {
        if (!this.enabled || !this.context) return;
        this.resume();

        const now = this.context.currentTime;
        this.playTone(440, now, 0.1);        // A4
        this.playTone(554.37, now + 0.1, 0.1); // C#5
        this.playTone(659.25, now + 0.2, 0.15); // E5
    },

    // Core tone generator
    playTone(frequency, startTime, duration, type = 'sine', volume = 0.3) {
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        // Envelope
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.1);
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    setEnabled(enabled) {
        this.enabled = enabled;
    }
};
