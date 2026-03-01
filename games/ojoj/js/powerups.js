class Ramp {
    constructor(x, y, width = RAMP_WIDTH, height = RAMP_HEIGHT) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = 'ramp';
        this.used = false;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    // Get the Y position on the ramp surface at a given world X
    getSurfaceY(worldX) {
        const relativeX = worldX - this.x;
        if (relativeX < 0 || relativeX > this.width) return null;

        const progress = relativeX / this.width;
        return this.y + this.height - (this.height * progress);
    }

    reset() {
        this.used = false;
    }
}
