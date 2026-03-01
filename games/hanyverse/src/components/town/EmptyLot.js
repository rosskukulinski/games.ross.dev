import Phaser from 'phaser';

export default class EmptyLot extends Phaser.GameObjects.Container {
  constructor(scene, x, y, lotData) {
    super(scene, x, y);

    this.scene = scene;
    this.lotData = lotData;
    this.isInteractive = true;
    this.hasBuilding = false;

    this.createLot();

    scene.add.existing(this);
  }

  createLot() {
    // Lot background with plus sign
    this.sprite = this.scene.add.image(0, 0, 'empty-lot');
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Pulsing animation for the plus sign
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.8, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Make interactive
    this.setSize(this.sprite.width, this.sprite.height);
    this.setInteractive({ useHandCursor: true });

    // Hover effects
    this.on('pointerover', this.onPointerOver, this);
    this.on('pointerout', this.onPointerOut, this);
    this.on('pointerdown', this.onPointerDown, this);
    this.on('pointerup', this.onPointerUp, this);
  }

  onPointerOver() {
    if (!this.isInteractive || this.hasBuilding) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      ease: 'Quad.easeOut'
    });
  }

  onPointerOut() {
    if (!this.isInteractive || this.hasBuilding) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Quad.easeOut'
    });
  }

  onPointerDown() {
    if (!this.isInteractive || this.hasBuilding) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
      ease: 'Quad.easeOut'
    });
  }

  onPointerUp() {
    if (!this.isInteractive || this.hasBuilding) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.emit('lot-selected', this.lotData);
      }
    });
  }

  setInteractiveState(enabled) {
    this.isInteractive = enabled;
    if (enabled && !this.hasBuilding) {
      this.setAlpha(1);
    } else {
      this.setAlpha(0.5);
    }
  }

  // Called when a custom building is placed here
  setBuilding(buildingData) {
    this.hasBuilding = true;
    this.customBuildingData = buildingData;

    // Hide the plus sign and show the custom building
    this.sprite.setVisible(false);

    // Create custom building representation
    this.customBuilding = this.scene.add.container(0, 0);

    // Simple representation of the custom building
    const buildingGraphics = this.scene.add.graphics();
    buildingGraphics.fillStyle(0xDEB887, 1);
    buildingGraphics.fillRoundedRect(-40, -80, 80, 80, 5);
    buildingGraphics.fillStyle(0x8B4513, 1);
    buildingGraphics.fillTriangle(0, -95, -45, -80, 45, -80);
    this.customBuilding.add(buildingGraphics);

    // Building name label
    if (buildingData.name) {
      const label = this.scene.add.text(0, -100, buildingData.name, {
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 }
      });
      label.setOrigin(0.5, 1);
      this.customBuilding.add(label);
    }

    this.add(this.customBuilding);

    // Disable further editing
    this.disableInteractive();
  }

  getLotData() {
    return this.lotData;
  }

  // Play the "poof" animation when building is created
  playPoofAnimation(callback) {
    // Create particle effect
    const particles = [];
    const colors = [0xFFFFFF, 0xFFE4B5, 0xFFF8DC, 0xFAFAD2];

    for (let i = 0; i < 20; i++) {
      const particle = this.scene.add.circle(
        this.x + Phaser.Math.Between(-30, 30),
        this.y - 50 + Phaser.Math.Between(-30, 30),
        Phaser.Math.Between(3, 8),
        colors[Phaser.Math.Between(0, colors.length - 1)]
      );
      particles.push(particle);

      this.scene.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-50, 50),
        y: particle.y + Phaser.Math.Between(-80, -20),
        alpha: 0,
        scale: 0,
        duration: 500 + Phaser.Math.Between(0, 300),
        ease: 'Quad.easeOut',
        onComplete: () => {
          particle.destroy();
        }
      });
    }

    // Call callback after animation
    this.scene.time.delayedCall(600, () => {
      if (callback) callback();
    });
  }
}
