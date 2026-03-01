class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    clear(width, height) {
        this.ctx.clearRect(0, 0, width, height);
    }

    // Draw the track background and lanes
    drawTrack(cameraX, canvasWidth, canvasHeight) {
        const ctx = this.ctx;

        // Sky/grass background
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Road surface
        const roadTop = LANE_HEIGHT - 20;
        const roadHeight = LANE_HEIGHT * 3 + 40;
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(0, roadTop, canvasWidth, roadHeight);

        // Road edges
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(0, roadTop, canvasWidth, 4);
        ctx.fillRect(0, roadTop + roadHeight - 4, canvasWidth, 4);

        // Lane dividers (dashed lines)
        ctx.strokeStyle = COLORS.roadLine;
        ctx.lineWidth = 3;
        ctx.setLineDash([40, 25]);

        const dashOffset = -(cameraX % 65);
        ctx.lineDashOffset = dashOffset;

        for (let lane = 1; lane < LANE_COUNT; lane++) {
            const y = LANE_HEIGHT * (lane + 1);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    // Draw car (player or AI) with custom color
    drawCar(car, cameraX) {
        if (!car.visible) return;

        const ctx = this.ctx;
        const x = car.x - cameraX;
        const y = car.y;
        const width = car.width;
        const height = car.height;
        const color = car.color || COLORS.car;

        ctx.save();

        // Apply jump scale
        if (car.jumpScale !== 1) {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(car.jumpScale, car.jumpScale);
            ctx.translate(-centerX, -centerY);
        }

        // Shadow when jumping
        if (car.isJumping) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(x + width / 2, car.groundY + height + 5, width / 2 - 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Shield effect (for Shield car when active)
        if (car.shieldActive) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(x + width / 2, y + height / 2, width / 2 + 10, height / 2 + 10, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner glow
            ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
            ctx.fill();
        }

        // Boost effect
        if (car.hasBoost()) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
            ctx.beginPath();
            ctx.moveTo(x - 20, y + height / 2);
            ctx.lineTo(x - 40, y + height / 2 - 15);
            ctx.lineTo(x - 30, y + height / 2);
            ctx.lineTo(x - 45, y + height / 2 + 15);
            ctx.closePath();
            ctx.fill();
        }

        // Car body with custom color
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 5);
        ctx.lineTo(x + width - 15, y + 5);
        ctx.quadraticCurveTo(x + width, y + 5, x + width, y + height / 2);
        ctx.quadraticCurveTo(x + width, y + height - 5, x + width - 10, y + height - 5);
        ctx.lineTo(x + 10, y + height - 5);
        ctx.quadraticCurveTo(x, y + height - 5, x, y + height / 2);
        ctx.quadraticCurveTo(x, y + 5, x + 10, y + 5);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Window
        ctx.fillStyle = COLORS.carWindow;
        ctx.fillRect(x + width * 0.35, y + 8, width * 0.35, height * 0.45);
        ctx.strokeRect(x + width * 0.35, y + 8, width * 0.35, height * 0.45);

        // Driver head
        ctx.fillStyle = COLORS.driver;
        ctx.beginPath();
        ctx.arc(x + width * 0.52, y + height * 0.35, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Eyes on driver
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x + width * 0.50, y + height * 0.32, 2, 0, Math.PI * 2);
        ctx.arc(x + width * 0.56, y + height * 0.32, 2, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = COLORS.wheel;
        ctx.beginPath();
        ctx.arc(x + 22, y + height, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width - 22, y + height, 13, 0, Math.PI * 2);
        ctx.fill();

        // Wheel centers
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(x + 22, y + height, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width - 22, y + height, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Draw fireball with spiky flames
    drawFireball(fireball, cameraX) {
        const ctx = this.ctx;
        const x = fireball.x - cameraX;
        const y = fireball.y;
        const radius = fireball.radius;
        const spikes = 8;

        ctx.fillStyle = COLORS.fireball;
        ctx.beginPath();
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2 + fireball.bobOffset;
            const nextAngle = ((i + 0.5) / spikes) * Math.PI * 2 + fireball.bobOffset;
            const outerX = x + Math.cos(angle) * radius * 1.4;
            const outerY = y + Math.sin(angle) * radius * 1.4;
            const innerX = x + Math.cos(nextAngle) * radius * 0.6;
            const innerY = y + Math.sin(nextAngle) * radius * 0.6;

            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = COLORS.fireballInner;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw lava ball with bubbling effect
    drawLavaBall(lavaBall, cameraX, time) {
        const ctx = this.ctx;
        const x = lavaBall.x - cameraX;
        const y = lavaBall.y;
        const radius = lavaBall.currentRadius;

        ctx.fillStyle = COLORS.lavaball;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        const bubbleOffset1 = Math.sin(time * 0.008) * 4;
        const bubbleOffset2 = Math.cos(time * 0.006) * 3;

        ctx.fillStyle = COLORS.lavaBubble;
        ctx.beginPath();
        ctx.arc(x - radius / 3, y - radius / 4 + bubbleOffset1, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + radius / 4, y + bubbleOffset2, radius * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.lavaDark;
        ctx.beginPath();
        ctx.arc(x + radius / 3, y + radius / 3, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw fan with spinning blades
    drawFan(fan, cameraX) {
        const ctx = this.ctx;
        const x = fan.x - cameraX;
        const y = fan.y;
        const width = fan.width;
        const height = fan.height;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Wind effect lines
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const lineX = x - 30 - i * 25;
            const offset = Math.sin(fan.rotation * 3 + i) * 10;
            ctx.beginPath();
            ctx.moveTo(lineX, centerY - 20 + offset);
            ctx.lineTo(lineX - 20, centerY + offset);
            ctx.lineTo(lineX, centerY + 20 + offset);
            ctx.stroke();
        }

        ctx.fillStyle = '#555';
        ctx.fillRect(centerX - 12, y + height - 15, 24, 18);

        ctx.fillStyle = COLORS.fan;
        ctx.beginPath();
        ctx.arc(centerX, centerY - 5, width / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY - 5);
        ctx.rotate(fan.rotation);

        ctx.fillStyle = COLORS.fanBlade;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, -width / 3.5, 7, width / 2.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3A70B9';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 5, 9, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw ramp
    drawRamp(ramp, cameraX) {
        const ctx = this.ctx;
        const x = ramp.x - cameraX;
        const y = ramp.y;
        const width = ramp.width;
        const height = ramp.height;

        ctx.fillStyle = COLORS.ramp;
        ctx.beginPath();
        ctx.moveTo(x, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width, y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#5D3A1A';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.strokeStyle = COLORS.rampStripe;
        ctx.lineWidth = 3;
        for (let i = 1; i < 4; i++) {
            const offset = (width / 4) * i;
            const stripeHeight = height * (offset / width);
            ctx.beginPath();
            ctx.moveTo(x + offset, y + height);
            ctx.lineTo(x + offset, y + height - stripeHeight);
            ctx.stroke();
        }

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('BOOST', x + 15, y + height - 8);
    }

    // Draw finish line
    drawFinishLine(finishX, cameraX, canvasHeight) {
        const ctx = this.ctx;
        const screenX = finishX - cameraX;
        const squareSize = 20;
        const lineWidth = 50;
        const roadTop = LANE_HEIGHT - 20;
        const roadHeight = LANE_HEIGHT * 3 + 40;

        for (let row = 0; row < roadHeight / squareSize; row++) {
            for (let col = 0; col < lineWidth / squareSize; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? '#FFF' : '#000';
                ctx.fillRect(
                    screenX + col * squareSize,
                    roadTop + row * squareSize,
                    squareSize,
                    squareSize
                );
            }
        }

        ctx.fillStyle = '#FF0000';
        ctx.fillRect(screenX - 10, roadTop - 35, lineWidth + 20, 32);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FINISH', screenX + lineWidth / 2, roadTop - 12);
        ctx.textAlign = 'left';
    }

    // Draw UI elements
    drawUI(player, level, canvasWidth, gameTime = 0) {
        this.drawLivesCounter(player.lives, 20, 35);
        this.drawProgressBar(player.x, level.finishLineX, canvasWidth / 2 - 150, 18, 300, 22);
        this.drawTimer(gameTime, canvasWidth - 120, 35);

        if (player.hasBoost()) {
            this.drawBoostIndicator(canvasWidth - 120, 70);
        }

        // Shield indicator for Shield car
        if (player.carType && player.carType.ability === 'autoShield') {
            this.drawShieldIndicator(canvasWidth - 120, player.hasBoost() ? 105 : 70, player.shieldAvailable);
        }
    }

    drawLivesCounter(lives, x, y) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 25, 130, 42, 8);
        ctx.fill();

        ctx.fillStyle = '#FF6B6B';
        ctx.font = '26px Arial';
        ctx.fillText('\u2764', x, y + 8);

        ctx.font = 'bold 26px Arial';
        if (lives <= 20) {
            ctx.fillStyle = '#FF4444';
        } else if (lives <= 50) {
            ctx.fillStyle = '#FFAA00';
        } else {
            ctx.fillStyle = '#FFF';
        }
        ctx.fillText(`${lives}`, x + 40, y + 8);
    }

    drawProgressBar(currentX, finishX, x, y, width, height) {
        const ctx = this.ctx;
        const progress = Math.min(Math.max(currentX / finishX, 0), 1);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PROGRESS', x + width / 2, y - 4);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 6);
        ctx.fill();

        if (progress > 0) {
            const gradient = ctx.createLinearGradient(x, y, x + width, y);
            gradient.addColorStop(0, '#4CAF50');
            gradient.addColorStop(0.5, '#8BC34A');
            gradient.addColorStop(1, '#CDDC39');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, (width - 4) * progress, height - 4, 4);
            ctx.fill();
        }

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`${Math.round(progress * 100)}%`, x + width / 2, y + height - 5);
        ctx.textAlign = 'left';
    }

    drawTimer(gameTime, x, y) {
        const ctx = this.ctx;
        const seconds = Math.floor(gameTime / 1000);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 20, 100, 35, 6);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`${seconds}s`, x + 10, y + 5);
    }

    drawBoostIndicator(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('\u26a1 BOOST!', x - 10, y);
    }

    drawShieldIndicator(x, y, available) {
        const ctx = this.ctx;
        ctx.fillStyle = available ? 'rgba(100, 200, 255, 0.9)' : 'rgba(100, 100, 100, 0.7)';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(available ? '\u26e8 READY' : '\u26e8 ...', x - 10, y);
    }

    drawGameOver(canvasWidth, canvasHeight) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 2 - 20);

        ctx.fillStyle = '#FFF';
        ctx.font = '28px Arial';
        ctx.fillText('Press SPACE to try again', canvasWidth / 2, canvasHeight / 2 + 40);
        ctx.textAlign = 'left';
    }

    // New race end screen with confetti
    drawRaceEndScreen(canvasWidth, canvasHeight, placement, lives, gameTime, confetti) {
        const ctx = this.ctx;

        // Draw confetti first (behind text)
        for (const c of confetti) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation * Math.PI / 180);
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Placement text
        const placementText = this.getPlacementText(placement);
        const isWinner = placement === 1;

        ctx.fillStyle = isWinner ? '#FFD700' : '#FFF';
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(isWinner ? 'You Won!' : placementText, canvasWidth / 2, canvasHeight / 2 - 80);

        // Stats box
        const boxX = canvasWidth / 2 - 150;
        const boxY = canvasHeight / 2 - 40;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, 300, 120, 15);
        ctx.fill();

        // Lives
        ctx.fillStyle = '#FF6B6B';
        ctx.font = '32px Arial';
        ctx.fillText('\u2764', canvasWidth / 2 - 80, boxY + 45);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${lives} lives`, canvasWidth / 2, boxY + 45);

        // Time
        const seconds = Math.floor(gameTime / 1000);
        ctx.fillStyle = '#4ECDC4';
        ctx.font = '32px Arial';
        ctx.fillText('\u23f1', canvasWidth / 2 - 80, boxY + 95);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${seconds} seconds`, canvasWidth / 2, boxY + 95);

        // Play again prompt
        ctx.fillStyle = '#AAA';
        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE to race again', canvasWidth / 2, canvasHeight / 2 + 130);

        ctx.textAlign = 'left';
    }

    getPlacementText(placement) {
        const suffixes = ['st', 'nd', 'rd', 'th', 'th'];
        const suffix = suffixes[Math.min(placement - 1, 4)];
        return `${placement}${suffix} Place!`;
    }
}
