class InputHandler {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            up: false,
            down: false
        };

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
        return this.keys[action] || false;
    }

    // Reset lane change keys after processing
    consumeLaneChange() {
        const up = this.keys.up;
        const down = this.keys.down;
        return { up, down };
    }
}
