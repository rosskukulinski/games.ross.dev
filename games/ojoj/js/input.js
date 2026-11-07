class InputHandler {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            up: false,
            down: false
        };

        // Touch play: the car drives itself (autoAccelerate) unless the brake
        // is held, and lane changes arrive as one-shot taps (-1 up, +1 down).
        this.autoAccelerate = false;
        this.touchBrake = false;
        this.pendingLane = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        switch (e.code) {
            case 'ArrowRight':
            case 'KeyD':
                this.keys.forward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.backward = true;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = true;
                break;
        }

        // Prevent default scrolling for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        switch (e.code) {
            case 'ArrowRight':
            case 'KeyD':
                this.keys.forward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.backward = false;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = false;
                break;
        }
    }

    isPressed(action) {
        if (this.autoAccelerate) {
            if (action === 'backward' && this.touchBrake) return true;
            if (action === 'forward' && !this.touchBrake && !this.keys.backward) return true;
        }
        return this.keys[action] || false;
    }

    // Queue a lane change from a tap; the player consumes it on its next free frame.
    queueLane(direction) {
        this.pendingLane = direction;
    }

    takeQueuedLane() {
        const d = this.pendingLane;
        this.pendingLane = 0;
        return d;
    }

    clearTouch() {
        this.touchBrake = false;
        this.pendingLane = 0;
    }

    // Reset lane change keys after processing
    consumeLaneChange() {
        const up = this.keys.up;
        const down = this.keys.down;
        return { up, down };
    }
}
