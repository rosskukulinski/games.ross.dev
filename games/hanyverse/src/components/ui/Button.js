import Phaser from 'phaser';

export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      text: config.text || 'Button',
      width: config.width || 180,
      height: config.height || 60,
      texture: config.texture || null,
      texturePressed: config.texturePressed || null,
      backgroundColor: config.backgroundColor || 0x4ade80,
      backgroundColorPressed: config.backgroundColorPressed || 0x22c55e,
      textColor: config.textColor || '#ffffff',
      fontSize: config.fontSize || '24px',
      onClick: config.onClick || (() => {}),
      disabled: config.disabled || false
    };

    this.isPressed = false;
    this.isDisabled = this.config.disabled;

    this.createButton();
    scene.add.existing(this);
  }

  createButton() {
    // Background
    if (this.config.texture && this.scene.textures.exists(this.config.texture)) {
      this.background = this.scene.add.image(0, 0, this.config.texture);
    } else {
      this.background = this.scene.add.graphics();
      this.drawBackground(this.config.backgroundColor);
    }
    this.add(this.background);

    // Text
    this.text = this.scene.add.text(0, 0, this.config.text, {
      fontSize: this.config.fontSize,
      fontFamily: 'Arial, sans-serif',
      color: this.config.textColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(this.text);

    // Make interactive
    this.setSize(this.config.width, this.config.height);
    this.setInteractive({ useHandCursor: true });

    // Events
    this.on('pointerdown', this.onPointerDown, this);
    this.on('pointerup', this.onPointerUp, this);
    this.on('pointerout', this.onPointerOut, this);
  }

  drawBackground(color) {
    if (this.background instanceof Phaser.GameObjects.Graphics) {
      this.background.clear();

      // Shadow
      this.background.fillStyle(0x000000, 0.3);
      this.background.fillRoundedRect(
        -this.config.width / 2 + 4,
        -this.config.height / 2 + 4,
        this.config.width,
        this.config.height,
        this.config.height / 2
      );

      // Main button
      this.background.fillStyle(color, 1);
      this.background.fillRoundedRect(
        -this.config.width / 2,
        -this.config.height / 2,
        this.config.width,
        this.config.height,
        this.config.height / 2
      );

      // Highlight
      this.background.fillStyle(0xffffff, 0.3);
      this.background.fillRoundedRect(
        -this.config.width / 2 + 10,
        -this.config.height / 2 + 5,
        this.config.width - 20,
        this.config.height / 3,
        this.config.height / 4
      );
    }
  }

  onPointerDown() {
    if (this.isDisabled) return;

    this.isPressed = true;
    this.setScale(0.95);

    if (this.config.texturePressed && this.background instanceof Phaser.GameObjects.Image) {
      this.background.setTexture(this.config.texturePressed);
    } else if (this.background instanceof Phaser.GameObjects.Graphics) {
      this.drawBackground(this.config.backgroundColorPressed);
    }
  }

  onPointerUp() {
    if (this.isDisabled || !this.isPressed) return;

    this.isPressed = false;
    this.setScale(1);

    if (this.config.texture && this.background instanceof Phaser.GameObjects.Image) {
      this.background.setTexture(this.config.texture);
    } else if (this.background instanceof Phaser.GameObjects.Graphics) {
      this.drawBackground(this.config.backgroundColor);
    }

    // Callback
    this.config.onClick();
  }

  onPointerOut() {
    if (this.isPressed) {
      this.isPressed = false;
      this.setScale(1);

      if (this.config.texture && this.background instanceof Phaser.GameObjects.Image) {
        this.background.setTexture(this.config.texture);
      } else if (this.background instanceof Phaser.GameObjects.Graphics) {
        this.drawBackground(this.config.backgroundColor);
      }
    }
  }

  setDisabled(disabled) {
    this.isDisabled = disabled;
    this.setAlpha(disabled ? 0.5 : 1);
  }

  setText(newText) {
    this.text.setText(newText);
  }
}
