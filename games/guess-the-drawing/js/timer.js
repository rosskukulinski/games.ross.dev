// Timer Module
// Handles countdown functionality

const Timer = {
    duration: 30,
    remaining: 30,
    intervalId: null,
    isRunning: false,
    onTickCallback: null,
    onCompleteCallback: null,
    onWarningCallback: null,
    warningThreshold: 5,

    start(duration, onComplete) {
        this.stop();

        this.duration = duration || 30;
        this.remaining = this.duration;
        this.onCompleteCallback = onComplete;
        this.isRunning = true;

        // Initial tick
        this.tick();

        // Start interval
        this.intervalId = setInterval(() => this.tick(), 1000);
    },

    tick() {
        if (this.onTickCallback) {
            this.onTickCallback(this.remaining);
        }

        // Check for warning threshold
        if (this.remaining <= this.warningThreshold && this.remaining > 0) {
            if (this.onWarningCallback) {
                this.onWarningCallback(this.remaining);
            }
        }

        // Check for completion
        if (this.remaining <= 0) {
            this.stop();
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            return;
        }

        this.remaining--;
    },

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    },

    pause() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    resume() {
        if (!this.isRunning || this.intervalId) return;

        this.intervalId = setInterval(() => this.tick(), 1000);
    },

    onTick(callback) {
        this.onTickCallback = callback;
    },

    onWarning(callback) {
        this.onWarningCallback = callback;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getRemainingTime() {
        return this.remaining;
    }
};
