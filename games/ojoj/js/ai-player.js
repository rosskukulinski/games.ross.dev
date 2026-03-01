class AIPlayer {
    constructor(x, laneIndex, color, name) {
        this.x = x;
        this.width = PLAYER_WIDTH;
        this.height = PLAYER_HEIGHT;
        this.currentLane = laneIndex;
        this.y = this.getLaneY(laneIndex);
        this.targetLaneY = this.y;
        this.velocityX = 0;

        // AI identity
        this.color = color;
        this.name = name;
        this.isPlayer = false;

        // Lane switching
        this.isChangingLane = false;
        this.laneChangeTimer = 0;
        this.laneChangeCooldown = 500; // ms between lane changes

        // Speed settings with some randomness
        this.baseSpeed = PLAYER_BASE_SPEED;
        this.maxSpeed = PLAYER_MAX_SPEED * (0.85 + Math.random() * AI_SPEED_VARIANCE * 2);
        this.acceleration = PLAYER_ACCELERATION * (0.9 + Math.random() * 0.2);
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

        // AI decision making
        this.detectionRange = 250; // How far ahead AI looks for obstacles
        this.reactionDelay = Math.random() * 200 + 100; // 100-300ms reaction time
    }

    getLaneY(laneIndex) {
        return LANE_HEIGHT * (laneIndex + 1.5) - this.height;
    }

    update(dt, obstacles) {
        if (this.eliminated || this.finished) return;

        const dtNormalized = dt / 16.67;

        // Handle speed boost expiration
        if (this.speedMultiplier > 1 && Date.now() > this.boostEndTime) {
            this.speedMultiplier = 1;
        }

        // Handle invulnerability expiration and flashing
        if (this.isInvulnerable) {
            if (Date.now() > this.invulnerableEndTime) {
                this.isInvulnerable = false;
                this.visible = true;
            } else {
                this.flashTimer += dt;
                if (this.flashTimer > 100) {
                    this.visible = !this.visible;
                    this.flashTimer = 0;
                }
            }
        }

        // AI always accelerates forward
        this.velocityX += this.acceleration;

        // Clamp speed
        const maxCurrentSpeed = this.maxSpeed * this.speedMultiplier;
        this.velocityX = Math.min(this.velocityX, maxCurrentSpeed);

        // Apply movement
        this.x += this.velocityX * dtNormalized;

        // AI obstacle avoidance
        this.laneChangeTimer += dt;
        if (this.laneChangeTimer >= this.laneChangeCooldown && !this.isChangingLane) {
            this.decideMovement(obstacles);
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
            this.jumpVelocity += 0.6;
            this.y += this.jumpVelocity * dtNormalized;

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

        // Keep in bounds
        this.x = Math.max(0, this.x);
    }

    decideMovement(obstacles) {
        // Look for obstacles ahead in current lane
        const myBounds = this.getBounds();
        let obstacleAhead = null;
        let closestDistance = this.detectionRange;

        for (const obs of obstacles) {
            if (!obs.active) continue;

            const obsX = obs.x;
            const obsY = obs.y;
            const distance = obsX - this.x;

            // Check if obstacle is ahead and in detection range
            if (distance > 0 && distance < closestDistance) {
                // Check if obstacle is in our lane (approximate)
                const obsLaneY = obsY;
                const myLaneY = this.y + this.height / 2;

                if (Math.abs(obsLaneY - myLaneY) < LANE_HEIGHT * 0.8) {
                    obstacleAhead = obs;
                    closestDistance = distance;
                }
            }
        }

        // If obstacle detected, try to change lanes
        if (obstacleAhead && closestDistance < this.detectionRange) {
            this.tryChangeLane();
        }
    }

    tryChangeLane() {
        // Randomly choose up or down, but prefer valid lanes
        const canGoUp = this.currentLane > 0;
        const canGoDown = this.currentLane < LANE_COUNT - 1;

        if (canGoUp && canGoDown) {
            // Random choice
            if (Math.random() > 0.5) {
                this.changeLane(-1);
            } else {
                this.changeLane(1);
            }
        } else if (canGoUp) {
            this.changeLane(-1);
        } else if (canGoDown) {
            this.changeLane(1);
        }
    }

    changeLane(direction) {
        this.currentLane += direction;
        this.isChangingLane = true;
        this.targetLaneY = this.getLaneY(this.currentLane);
        this.laneChangeTimer = 0;
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

    loseLife() {
        this.lives--;
        this.knockBack();
        this.makeInvulnerable(PLAYER_INVULNERABLE_TIME);
    }

    eliminate() {
        this.eliminated = true;
        this.visible = false;
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

    finish(time) {
        if (!this.finished) {
            this.finished = true;
            this.finishTime = time;
        }
    }
}
