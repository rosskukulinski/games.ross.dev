class Player {
    constructor(x, laneIndex, carType = null, color = null) {
        this.x = x;
        this.width = PLAYER_WIDTH;
        this.height = PLAYER_HEIGHT;
        this.currentLane = laneIndex;
        this.y = this.getLaneY(laneIndex);
        this.targetLaneY = this.y;
        this.velocityX = 0;

        // Car type and appearance
        this.carType = carType;
        this.color = color || (carType ? carType.color : COLORS.car);
        this.isPlayer = true;

        // Lane switching
        this.isChangingLane = false;
        this.laneChangeKeyReleased = true;

        // Speed settings - apply car type multipliers
        this.baseSpeed = PLAYER_BASE_SPEED;
        this.maxSpeed = PLAYER_MAX_SPEED * (carType ? carType.maxSpeedMultiplier : 1);
        this.acceleration = PLAYER_ACCELERATION * (carType ? carType.accelerationMultiplier : 1);
        this.friction = PLAYER_FRICTION;

        // Speed boost
        this.speedMultiplier = 1;
        this.boostEndTime = 0;

        // Jump state
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.groundY = this.y;
        this.jumpScale = 1;

        // Game state
        this.lives = PLAYER_START_LIVES;
        this.isInvulnerable = false;
        this.invulnerableEndTime = 0;
        this.flashTimer = 0;
        this.visible = true;
        this.eliminated = false;

        // Race tracking
        this.finished = false;
        this.finishTime = 0;

        // Shield ability (for SHIELD car type)
        this.shieldAvailable = true;
        this.shieldCooldownEnd = 0;
        this.shieldActive = false;
        this.shieldActiveEnd = 0;
    }

    getLaneY(laneIndex) {
        return LANE_HEIGHT * (laneIndex + 1.5) - this.height;
    }

    update(dt, input, audio) {
        if (this.eliminated || this.finished) return;

        const dtNormalized = dt / 16.67;

        // Handle speed boost expiration
        if (this.speedMultiplier > 1 && Date.now() > this.boostEndTime) {
            this.speedMultiplier = 1;
        }

        // Handle shield cooldown
        if (!this.shieldAvailable && Date.now() > this.shieldCooldownEnd) {
            this.shieldAvailable = true;
        }

        // Handle shield active duration
        if (this.shieldActive && Date.now() > this.shieldActiveEnd) {
            this.shieldActive = false;
        }

        // Handle invulnerability expiration and flashing
        if (this.isInvulnerable) {
            if (Date.now() > this.invulnerableEndTime) {
                this.isInvulnerable = false;
                this.visible = true;
            } else {
                // Flash effect
                this.flashTimer += dt;
                if (this.flashTimer > 100) {
                    this.visible = !this.visible;
                    this.flashTimer = 0;
                }
            }
        }

        // Forward/Backward movement
        if (input.isPressed('forward')) {
            this.velocityX += this.acceleration;
        } else if (input.isPressed('backward')) {
            this.velocityX -= this.acceleration * 0.5;
        } else {
            // Apply friction
            this.velocityX *= (1 - this.friction);
        }

        // Clamp speed
        const maxCurrentSpeed = this.maxSpeed * this.speedMultiplier;
        this.velocityX = Math.max(-this.baseSpeed * 0.5, Math.min(this.velocityX, maxCurrentSpeed));

        // Apply movement
        this.x += this.velocityX * dtNormalized;

        // Lane changing - only trigger on initial press
        if (!input.isPressed('up') && !input.isPressed('down')) {
            this.laneChangeKeyReleased = true;
        }

        if (this.laneChangeKeyReleased && !this.isChangingLane) {
            if (input.isPressed('up') && this.currentLane > 0) {
                this.currentLane--;
                this.isChangingLane = true;
                this.laneChangeKeyReleased = false;
                this.targetLaneY = this.getLaneY(this.currentLane);
                if (audio) audio.playLaneChange();
            } else if (input.isPressed('down') && this.currentLane < LANE_COUNT - 1) {
                this.currentLane++;
                this.isChangingLane = true;
                this.laneChangeKeyReleased = false;
                this.targetLaneY = this.getLaneY(this.currentLane);
                if (audio) audio.playLaneChange();
            }
        }

        // Smooth lane transition
        if (this.isChangingLane) {
            const diff = this.targetLaneY - this.groundY;

            if (Math.abs(diff) < PLAYER_LANE_SWITCH_SPEED) {
                this.groundY = this.targetLaneY;
                this.isChangingLane = false;
            } else {
                this.groundY += Math.sign(diff) * PLAYER_LANE_SWITCH_SPEED;
            }
        }

        // Handle jumping
        if (this.isJumping) {
            this.jumpVelocity += 0.6; // Gravity
            this.y += this.jumpVelocity * dtNormalized;

            // Scale effect during jump
            const jumpProgress = Math.abs(this.jumpVelocity) / Math.abs(JUMP_VELOCITY);
            this.jumpScale = 1 + (1 - jumpProgress) * 0.3;

            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.isJumping = false;
                this.jumpVelocity = 0;
                this.jumpScale = 1;
            }
        } else {
            this.y = this.groundY;
        }

        // Keep player in bounds
        this.x = Math.max(0, this.x);
    }

    triggerJump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = JUMP_VELOCITY;
            this.groundY = this.y;
        }
    }

    applySpeedBoost(multiplier, duration) {
        this.speedMultiplier = multiplier;
        this.boostEndTime = Date.now() + duration;
    }

    applyWindForce(force) {
        this.velocityX += force * 0.08;
    }

    knockBack() {
        this.x -= PLAYER_KNOCKBACK;
        this.x = Math.max(0, this.x);
        this.velocityX = 0;
    }

    makeInvulnerable(duration) {
        this.isInvulnerable = true;
        this.invulnerableEndTime = Date.now() + duration;
        this.flashTimer = 0;
    }

    // Try to activate auto-shield (for Shield car)
    tryAutoShield() {
        if (this.carType && this.carType.ability === 'autoShield' && this.shieldAvailable) {
            this.shieldAvailable = false;
            this.shieldActive = true;
            this.shieldActiveEnd = Date.now() + 500; // Shield lasts 0.5 seconds
            this.shieldCooldownEnd = Date.now() + (this.carType.shieldCooldown || 3000);
            return true; // Shield activated, avoid damage
        }
        return false; // No shield, take damage
    }

    // Check if this car can eat other cars (Chomper ability)
    canEatCars() {
        return this.carType && this.carType.ability === 'eatCars';
    }

    loseLife() {
        this.lives--;
        this.knockBack();
        this.makeInvulnerable(PLAYER_INVULNERABLE_TIME);
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    hasBoost() {
        return this.speedMultiplier > 1;
    }

    // Mark as finished the race
    finish(time) {
        if (!this.finished) {
            this.finished = true;
            this.finishTime = time;
        }
    }
}
