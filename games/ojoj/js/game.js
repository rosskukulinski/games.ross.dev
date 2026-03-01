class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = GameState.MENU;
        this.lastTime = 0;
        this.gameTime = 0;

        // Game objects
        this.player = null;
        this.aiPlayers = [];
        this.level = null;
        this.input = null;
        this.renderer = null;
        this.audio = null;

        // Camera
        this.cameraX = 0;

        // Wind sound cooldown
        this.lastWindSound = 0;

        // Race results
        this.raceResults = [];
        this.allFinished = false;

        // Confetti for end screen
        this.confetti = [];
    }

    init(carType = null) {
        // Create player with selected car type
        this.player = new Player(PLAYER_START_X, 1, carType);
        this.player.isPlayer = true;

        // Create AI players in different lanes
        this.aiPlayers = [];
        const aiLanes = [0, 2, 0, 2]; // Alternate lanes
        const aiNames = ['Racer 1', 'Racer 2', 'Racer 3', 'Racer 4'];

        for (let i = 0; i < AI_COUNT; i++) {
            const lane = aiLanes[i % aiLanes.length];
            const ai = new AIPlayer(
                PLAYER_START_X - 20 - (i * 30), // Stagger start positions slightly
                lane,
                AI_COLORS[i],
                aiNames[i]
            );
            this.aiPlayers.push(ai);
        }

        // Load level
        this.level = new Level();
        this.level.load();

        // Reset state
        this.cameraX = 0;
        this.gameTime = 0;
        this.raceResults = [];
        this.allFinished = false;
        this.confetti = [];
        this.state = GameState.PLAYING;
    }

    reset() {
        // Don't auto-reset, go to car select via main.js
    }

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        const dt = Math.min(deltaTime, 50);

        this.update(dt);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(dt) {
        if (this.state !== GameState.PLAYING && this.state !== GameState.RACE_END) return;

        // Update confetti if race ended
        if (this.state === GameState.RACE_END) {
            this.updateConfetti(dt);
            return;
        }

        this.gameTime += dt;

        // Update player
        this.player.update(dt, this.input, this.audio);

        // Update AI players
        for (const ai of this.aiPlayers) {
            ai.update(dt, this.level.obstacles);
        }

        // Update level (obstacles)
        this.level.update(dt);

        // Check collisions for player
        this.checkPlayerCollisions();

        // Check collisions for AI
        this.checkAICollisions();

        // Check player-AI collisions (Chomper ability)
        this.checkPlayerAICollisions();

        // Update camera to follow player
        this.updateCamera();

        // Check finish conditions
        this.checkFinishConditions();

        // Check game over
        if (this.player.lives <= 0 && !this.player.finished) {
            this.player.eliminated = true;
            this.endRace();
        }
    }

    updateCamera() {
        const targetCameraX = this.player.x - 200;
        this.cameraX = Math.max(0, targetCameraX);
    }

    checkPlayerCollisions() {
        const playerBounds = this.player.getBounds();
        const canTakeDamage = !this.player.isInvulnerable && !this.player.finished;

        for (const obstacle of this.level.obstacles) {
            if (!obstacle.active) continue;

            let collision = false;

            if (obstacle.type === 'fireball') {
                collision = CollisionSystem.checkCircleRect(
                    { x: obstacle.x, y: obstacle.y, radius: obstacle.radius },
                    playerBounds
                );
            } else if (obstacle.type === 'lavaball') {
                collision = CollisionSystem.checkCircleRect(
                    { x: obstacle.x, y: obstacle.y, radius: obstacle.currentRadius },
                    playerBounds
                );
            } else if (obstacle.type === 'fan') {
                if (CollisionSystem.checkWindZone(obstacle, playerBounds)) {
                    this.player.applyWindForce(-obstacle.windStrength);

                    if (this.gameTime - this.lastWindSound > 500) {
                        if (this.audio) this.audio.playWind();
                        this.lastWindSound = this.gameTime;
                    }
                }
                collision = CollisionSystem.checkAABB(obstacle.getBounds(), playerBounds);
            }

            if (collision && canTakeDamage) {
                // Try auto-shield for Shield car
                if (this.player.tryAutoShield()) {
                    if (this.audio) this.audio.playBoost(); // Shield sound
                } else {
                    this.player.loseLife();
                    if (this.audio) this.audio.playCollision();
                }
            }
        }

        // Check ramp collisions for player
        for (const ramp of this.level.ramps) {
            const rampCheck = CollisionSystem.checkRampCollision(ramp, playerBounds);
            if (rampCheck.hit && !ramp.used && !this.player.isJumping) {
                ramp.used = true;
                this.player.triggerJump();
                this.player.applySpeedBoost(BOOST_MULTIPLIER, BOOST_DURATION);
                if (this.audio) this.audio.playBoost();
                setTimeout(() => ramp.used = false, 1000);
            }
        }
    }

    checkAICollisions() {
        for (const ai of this.aiPlayers) {
            if (ai.eliminated || ai.finished) continue;

            const aiBounds = ai.getBounds();
            const canTakeDamage = !ai.isInvulnerable;

            for (const obstacle of this.level.obstacles) {
                if (!obstacle.active) continue;

                let collision = false;

                if (obstacle.type === 'fireball') {
                    collision = CollisionSystem.checkCircleRect(
                        { x: obstacle.x, y: obstacle.y, radius: obstacle.radius },
                        aiBounds
                    );
                } else if (obstacle.type === 'lavaball') {
                    collision = CollisionSystem.checkCircleRect(
                        { x: obstacle.x, y: obstacle.y, radius: obstacle.currentRadius },
                        aiBounds
                    );
                } else if (obstacle.type === 'fan') {
                    if (CollisionSystem.checkWindZone(obstacle, aiBounds)) {
                        ai.applyWindForce(-obstacle.windStrength);
                    }
                    collision = CollisionSystem.checkAABB(obstacle.getBounds(), aiBounds);
                }

                if (collision && canTakeDamage) {
                    ai.loseLife();
                    if (ai.lives <= 0) {
                        ai.eliminated = true;
                    }
                }
            }

            // Check ramp collisions for AI
            for (const ramp of this.level.ramps) {
                const rampCheck = CollisionSystem.checkRampCollision(ramp, aiBounds);
                if (rampCheck.hit && !ai.isJumping) {
                    ai.triggerJump();
                    ai.applySpeedBoost(BOOST_MULTIPLIER, BOOST_DURATION);
                }
            }
        }
    }

    checkPlayerAICollisions() {
        if (!this.player.canEatCars() || this.player.finished || this.player.eliminated) return;

        const playerBounds = this.player.getBounds();

        for (const ai of this.aiPlayers) {
            if (ai.eliminated || ai.finished) continue;

            const aiBounds = ai.getBounds();

            if (CollisionSystem.checkAABB(playerBounds, aiBounds)) {
                // Chomper eats the AI car!
                ai.eliminate();
                if (this.audio) this.audio.playCollision(); // Chomp sound
            }
        }
    }

    checkFinishConditions() {
        const finishX = this.level.finishLineX;

        // Check if player finished
        if (!this.player.finished && !this.player.eliminated && this.player.x >= finishX) {
            this.player.finish(this.gameTime);
            this.raceResults.push({
                name: 'You',
                isPlayer: true,
                lives: this.player.lives,
                time: this.gameTime,
                eliminated: false
            });
        }

        // Check if AI finished
        for (const ai of this.aiPlayers) {
            if (!ai.finished && !ai.eliminated && ai.x >= finishX) {
                ai.finish(this.gameTime);
                this.raceResults.push({
                    name: ai.name,
                    isPlayer: false,
                    lives: ai.lives,
                    time: this.gameTime,
                    eliminated: false
                });
            }
        }

        // Check if all racers are done
        const allDone = (this.player.finished || this.player.eliminated) &&
            this.aiPlayers.every(ai => ai.finished || ai.eliminated);

        if (allDone && !this.allFinished) {
            this.allFinished = true;
            this.endRace();
        }
    }

    endRace() {
        // Add eliminated racers to results
        if (this.player.eliminated && !this.raceResults.find(r => r.isPlayer)) {
            this.raceResults.push({
                name: 'You',
                isPlayer: true,
                lives: 0,
                time: this.gameTime,
                eliminated: true
            });
        }

        for (const ai of this.aiPlayers) {
            if (ai.eliminated && !this.raceResults.find(r => r.name === ai.name)) {
                this.raceResults.push({
                    name: ai.name,
                    isPlayer: false,
                    lives: 0,
                    time: this.gameTime,
                    eliminated: true
                });
            }
        }

        // Sort results: lives desc, then time asc
        this.raceResults.sort((a, b) => {
            if (a.eliminated && !b.eliminated) return 1;
            if (!a.eliminated && b.eliminated) return -1;
            if (b.lives !== a.lives) return b.lives - a.lives;
            return a.time - b.time;
        });

        // Create confetti
        this.createConfetti();

        this.state = GameState.RACE_END;
        if (this.audio) {
            const playerResult = this.raceResults.find(r => r.isPlayer);
            const playerPlace = this.raceResults.indexOf(playerResult) + 1;
            if (playerPlace === 1) {
                this.audio.playWin();
            } else {
                this.audio.playGameOver();
            }
        }
    }

    createConfetti() {
        this.confetti = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

        for (let i = 0; i < 100; i++) {
            this.confetti.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                size: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedY: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 2,
                rotation: Math.random() * 360
            });
        }
    }

    updateConfetti(dt) {
        for (const c of this.confetti) {
            c.y += c.speedY * (dt / 16);
            c.x += c.speedX * (dt / 16);
            c.rotation += 2;

            // Wrap around
            if (c.y > this.canvas.height + 20) {
                c.y = -20;
                c.x = Math.random() * this.canvas.width;
            }
        }
    }

    getPlayerPlacement() {
        const playerResult = this.raceResults.find(r => r.isPlayer);
        return playerResult ? this.raceResults.indexOf(playerResult) + 1 : this.raceResults.length;
    }

    render() {
        this.renderer.clear(this.canvas.width, this.canvas.height);

        // Draw track
        this.renderer.drawTrack(this.cameraX, this.canvas.width, this.canvas.height);

        // Draw finish line if visible
        const finishScreenX = this.level.finishLineX - this.cameraX;
        if (finishScreenX < this.canvas.width + 100 && finishScreenX > -100) {
            this.renderer.drawFinishLine(this.level.finishLineX, this.cameraX, this.canvas.height);
        }

        // Draw ramps
        for (const ramp of this.level.ramps) {
            const screenX = ramp.x - this.cameraX;
            if (screenX > -ramp.width && screenX < this.canvas.width + ramp.width) {
                this.renderer.drawRamp(ramp, this.cameraX);
            }
        }

        // Draw obstacles
        for (const obstacle of this.level.obstacles) {
            const screenX = obstacle.x - this.cameraX;
            if (screenX > -100 && screenX < this.canvas.width + 100) {
                if (obstacle.type === 'fireball') {
                    this.renderer.drawFireball(obstacle, this.cameraX);
                } else if (obstacle.type === 'lavaball') {
                    this.renderer.drawLavaBall(obstacle, this.cameraX, this.gameTime);
                } else if (obstacle.type === 'fan') {
                    this.renderer.drawFan(obstacle, this.cameraX);
                }
            }
        }

        // Draw AI players
        for (const ai of this.aiPlayers) {
            if (!ai.eliminated) {
                const screenX = ai.x - this.cameraX;
                if (screenX > -100 && screenX < this.canvas.width + 100) {
                    this.renderer.drawCar(ai, this.cameraX);
                }
            }
        }

        // Draw player (on top)
        if (!this.player.eliminated) {
            this.renderer.drawCar(this.player, this.cameraX);
        }

        // Draw UI
        this.renderer.drawUI(this.player, this.level, this.canvas.width, this.gameTime);

        // Draw race end screen
        if (this.state === GameState.RACE_END) {
            this.renderer.drawRaceEndScreen(
                this.canvas.width,
                this.canvas.height,
                this.getPlayerPlacement(),
                this.player.lives,
                this.gameTime,
                this.confetti
            );
        } else if (this.state === GameState.GAME_OVER) {
            this.renderer.drawGameOver(this.canvas.width, this.canvas.height);
        }
    }
}
