class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.active = true;
    }

    update(dt) {
        // Override in subclasses
    }

    getBounds() {
        return { x: this.x, y: this.y, width: 0, height: 0 };
    }
}

class Fireball extends Obstacle {
    constructor(x, y, radius = FIREBALL_RADIUS) {
        super(x, y, 'fireball');
        this.radius = radius;
        this.baseY = y;
        this.minY = LANE_HEIGHT * 1.2;
        this.maxY = LANE_HEIGHT * 3.3;
        this.verticalSpeed = FIREBALL_VERTICAL_SPEED;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.bobSpeed = 0.005;
    }

    update(dt) {
        // Move up and down between lanes
        this.y += this.verticalSpeed * this.direction * (dt / 16.67);

        // Bounce at lane boundaries
        if (this.y <= this.minY) {
            this.y = this.minY;
            this.direction = 1;
        } else if (this.y >= this.maxY) {
            this.y = this.maxY;
            this.direction = -1;
        }

        // Add subtle bobbing
        this.bobOffset += this.bobSpeed * dt;
    }

    getBounds() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }
}

class LavaBall extends Obstacle {
    constructor(x, y, radius = LAVABALL_RADIUS) {
        super(x, y, 'lavaball');
        this.radius = radius;
        this.baseX = x;
        this.horizontalSpeed = LAVABALL_HORIZONTAL_SPEED;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.moveRange = 80;
        this.animationTime = Math.random() * 1000;
        this.pulseSpeed = 0.005;
        this.currentRadius = radius;
    }

    update(dt) {
        // Move side to side
        this.x += this.horizontalSpeed * this.direction * (dt / 16.67);

        // Bounce at movement range
        if (this.x <= this.baseX - this.moveRange) {
            this.x = this.baseX - this.moveRange;
            this.direction = 1;
        } else if (this.x >= this.baseX + this.moveRange) {
            this.x = this.baseX + this.moveRange;
            this.direction = -1;
        }

        // Pulsing effect
        this.animationTime += dt;
        this.currentRadius = this.radius + Math.sin(this.animationTime * this.pulseSpeed) * 4;
    }

    getBounds() {
        const r = this.currentRadius;
        return {
            x: this.x - r,
            y: this.y - r,
            width: r * 2,
            height: r * 2
        };
    }
}

class Fan extends Obstacle {
    constructor(x, y, width = FAN_WIDTH, height = FAN_HEIGHT, windStrength = FAN_WIND_STRENGTH, windRange = FAN_WIND_RANGE) {
        super(x, y, 'fan');
        this.width = width;
        this.height = height;
        this.windStrength = windStrength;
        this.windRange = windRange;
        this.rotation = 0;
        this.rotationSpeed = 0.02;
    }

    update(dt) {
        // Spin the fan blades
        this.rotation += this.rotationSpeed * dt;
        if (this.rotation > Math.PI * 2) {
            this.rotation -= Math.PI * 2;
        }
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    getWindZone() {
        return {
            x: this.x - this.windRange,
            y: this.y,
            width: this.windRange,
            height: this.height
        };
    }
}
