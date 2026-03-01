import Phaser from 'phaser';
import { Avatar } from '../Avatar.js';

export default class PlayerCharacter extends Phaser.GameObjects.Container {
  constructor(scene, x, y, avatarConfig) {
    super(scene, x, y);

    this.scene = scene;
    this.avatarConfig = avatarConfig;
    this.isMoving = false;
    this.moveSpeed = 150; // pixels per second
    this.targetPosition = null;

    this.createCharacter();

    scene.add.existing(this);
  }

  createCharacter() {
    // Create avatar at smaller scale for town view
    this.avatar = new Avatar(this.scene, 0, 0, this.avatarConfig);
    this.avatar.setScale(0.5);
    this.add(this.avatar);

    // Add a subtle shadow
    this.shadow = this.scene.add.ellipse(0, 45, 35, 10, 0x000000, 0.3);
    this.addAt(this.shadow, 0);

    // Walking animation state
    this.walkTween = null;
    this.bounceTween = null;
  }

  moveTo(targetX, targetY, onComplete) {
    // Stop any existing movement
    this.stopMovement();

    this.targetPosition = { x: targetX, y: targetY };
    this.isMoving = true;

    // Calculate distance and duration
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const duration = (distance / this.moveSpeed) * 1000;

    // Emit event that movement started
    this.emit('move-start', this.targetPosition);

    // Start walking bounce animation
    this.startWalkAnimation();

    // Flip character based on direction
    if (targetX < this.x) {
      this.avatar.setScale(-0.5, 0.5);
    } else if (targetX > this.x) {
      this.avatar.setScale(0.5, 0.5);
    }

    // Move to target
    this.walkTween = this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.stopMovement();
        this.emit('move-complete', this.targetPosition);
        if (onComplete) onComplete();
      }
    });
  }

  startWalkAnimation() {
    // Subtle bouncing while walking
    this.bounceTween = this.scene.tweens.add({
      targets: this.avatar,
      y: -3,
      duration: 150,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  stopWalkAnimation() {
    if (this.bounceTween) {
      this.bounceTween.stop();
      this.bounceTween = null;
    }
    this.avatar.y = 0;
  }

  stopMovement() {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
    this.stopWalkAnimation();
    this.isMoving = false;
    this.targetPosition = null;
  }

  // Check if player is near a specific position (for building interaction)
  isNearPosition(x, y, threshold = 50) {
    return Phaser.Math.Distance.Between(this.x, this.y, x, y) <= threshold;
  }

  // Get the player's current grid position
  getGridPosition(cellWidth, cellHeight) {
    return {
      col: Math.floor(this.x / cellWidth),
      row: Math.floor(this.y / cellHeight)
    };
  }

  // Update avatar configuration (if changed elsewhere)
  updateConfig(newConfig) {
    this.avatarConfig = { ...this.avatarConfig, ...newConfig };
    // The avatar would need to be recreated or updated
    // For simplicity, we'll recreate it
    this.avatar.destroy();
    this.avatar = new Avatar(this.scene, 0, 0, this.avatarConfig);
    this.avatar.setScale(0.5);
    this.add(this.avatar);
  }

  // Play a celebration animation
  celebrate() {
    this.scene.tweens.add({
      targets: this.avatar,
      y: -20,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: 'Bounce.easeOut'
    });
  }

  // Get bounds for collision detection
  getBounds() {
    return new Phaser.Geom.Rectangle(
      this.x - 15,
      this.y - 25,
      30,
      50
    );
  }

  destroy() {
    this.stopMovement();
    super.destroy();
  }
}
