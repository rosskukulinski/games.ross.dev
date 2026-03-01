import Phaser from 'phaser';

export class TextInput extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      placeholder: config.placeholder || 'Enter text...',
      maxLength: config.maxLength || 20,
      width: config.width || 250,
      height: config.height || 50,
      onChange: config.onChange || (() => {}),
      fontSize: config.fontSize || '18px'
    };

    this.value = '';
    this.isFocused = false;

    this.createInput();
    scene.add.existing(this);
  }

  createInput() {
    const { width, height, placeholder, fontSize } = this.config;

    // Background
    this.background = this.scene.add.graphics();
    this.drawBackground(false);
    this.add(this.background);

    // Display text
    this.displayText = this.scene.add.text(0, 0, placeholder, {
      fontSize: fontSize,
      fontFamily: 'Arial, sans-serif',
      color: '#999999'
    }).setOrigin(0.5);
    this.add(this.displayText);

    // Cursor (blinking line)
    this.cursor = this.scene.add.rectangle(0, 0, 2, 24, 0x333333);
    this.cursor.setVisible(false);
    this.add(this.cursor);

    // Make interactive
    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', () => this.focus());

    // Create hidden DOM input for mobile keyboard
    this.createHiddenInput();
  }

  createHiddenInput() {
    // Create a hidden input element for mobile keyboard support
    this.domInput = document.createElement('input');
    this.domInput.type = 'text';
    this.domInput.maxLength = this.config.maxLength;
    this.domInput.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(this.domInput);

    this.domInput.addEventListener('input', (e) => {
      this.setValue(e.target.value);
    });

    this.domInput.addEventListener('blur', () => {
      this.blur();
    });

    // Clean up on scene shutdown
    this.scene.events.on('shutdown', () => {
      if (this.domInput && this.domInput.parentNode) {
        this.domInput.parentNode.removeChild(this.domInput);
      }
    });

    this.scene.events.on('destroy', () => {
      if (this.domInput && this.domInput.parentNode) {
        this.domInput.parentNode.removeChild(this.domInput);
      }
    });
  }

  drawBackground(focused) {
    const { width, height } = this.config;
    this.background.clear();

    // Shadow
    this.background.fillStyle(0x000000, 0.1);
    this.background.fillRoundedRect(-width / 2 + 2, -height / 2 + 2, width, height, 12);

    // Main background
    this.background.fillStyle(0xffffff, 0.95);
    this.background.fillRoundedRect(-width / 2, -height / 2, width, height, 12);

    // Border
    this.background.lineStyle(focused ? 3 : 2, focused ? 0x4ade80 : 0xcccccc, 1);
    this.background.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
  }

  focus() {
    this.isFocused = true;
    this.drawBackground(true);

    // Show cursor
    this.cursor.setVisible(true);
    this.startCursorBlink();

    // Focus the hidden DOM input to trigger mobile keyboard
    this.domInput.value = this.value;
    this.domInput.focus();

    // Update cursor position
    this.updateCursorPosition();
  }

  blur() {
    this.isFocused = false;
    this.drawBackground(false);
    this.cursor.setVisible(false);
    this.stopCursorBlink();
  }

  startCursorBlink() {
    this.stopCursorBlink();
    this.cursorTween = this.scene.tweens.add({
      targets: this.cursor,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  stopCursorBlink() {
    if (this.cursorTween) {
      this.cursorTween.stop();
      this.cursorTween = null;
    }
  }

  setValue(text) {
    this.value = text.slice(0, this.config.maxLength);
    this.domInput.value = this.value;

    if (this.value.length > 0) {
      this.displayText.setText(this.value);
      this.displayText.setColor('#333333');
    } else {
      this.displayText.setText(this.config.placeholder);
      this.displayText.setColor('#999999');
    }

    this.updateCursorPosition();
    this.config.onChange(this.value);
  }

  updateCursorPosition() {
    if (this.value.length > 0) {
      this.cursor.x = this.displayText.x + this.displayText.width / 2 + 2;
    } else {
      this.cursor.x = 0;
    }
  }

  getValue() {
    return this.value;
  }

  clear() {
    this.setValue('');
  }
}
