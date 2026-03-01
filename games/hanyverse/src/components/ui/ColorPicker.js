import Phaser from 'phaser';

export class ColorPicker extends Phaser.GameObjects.Container {
  constructor(scene, x, y, colors, onSelect) {
    super(scene, x, y);

    this.colors = colors; // [{ key, name, hex }, ...]
    this.onSelect = onSelect || (() => {});
    this.selectedKey = null;
    this.swatches = [];

    this.createColorPicker();
    scene.add.existing(this);
  }

  createColorPicker() {
    const swatchSize = 36;
    const gap = 8;
    const totalHeight = this.colors.length * swatchSize + (this.colors.length - 1) * gap;
    const startY = -totalHeight / 2 + swatchSize / 2;

    // Background panel
    const panelPadding = 10;
    this.panel = this.scene.add.graphics();
    this.panel.fillStyle(0xffffff, 0.2);
    this.panel.fillRoundedRect(
      -swatchSize / 2 - panelPadding,
      -totalHeight / 2 - panelPadding,
      swatchSize + panelPadding * 2,
      totalHeight + panelPadding * 2,
      15
    );
    this.add(this.panel);

    // Label
    const label = this.scene.add.text(0, startY - 35, 'Skin', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.add(label);

    this.colors.forEach((color, index) => {
      const y = startY + index * (swatchSize + gap);
      const swatch = this.createSwatch(color, y, swatchSize);
      this.swatches.push({ key: color.key, hex: color.hex, container: swatch });
    });
  }

  createSwatch(color, y, size) {
    const container = this.scene.add.container(0, y);

    // Swatch circle
    const circle = this.scene.add.graphics();
    circle.fillStyle(color.hex, 1);
    circle.fillCircle(0, 0, size / 2 - 2);
    circle.lineStyle(2, 0xffffff, 0.5);
    circle.strokeCircle(0, 0, size / 2 - 2);
    container.add(circle);
    container.circle = circle;

    // Selection ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xffd700, 1);
    ring.strokeCircle(0, 0, size / 2 + 2);
    ring.setVisible(false);
    container.add(ring);
    container.ring = ring;

    // Make interactive
    container.setSize(size, size);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.setSelected(color.key, true);
    });

    container.on('pointerover', () => {
      if (color.key !== this.selectedKey) {
        this.scene.tweens.add({
          targets: container,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100
        });
      }
    });

    container.on('pointerout', () => {
      if (color.key !== this.selectedKey) {
        this.scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      }
    });

    this.add(container);
    return container;
  }

  setSelected(key, animate = true) {
    this.selectedKey = key;

    this.swatches.forEach(swatch => {
      const isSelected = swatch.key === key;
      swatch.container.ring.setVisible(isSelected);

      if (isSelected) {
        swatch.container.setScale(1.15);
        if (animate) {
          this.scene.tweens.add({
            targets: swatch.container,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 100,
            yoyo: true
          });
          this.onSelect(this.colors.find(c => c.key === key));
        }
      } else {
        swatch.container.setScale(1);
      }
    });
  }

  setSelectedByHex(hex, animate = true) {
    const color = this.colors.find(c => c.hex === hex);
    if (color) {
      this.setSelected(color.key, animate);
    }
  }

  getSelected() {
    return this.colors.find(c => c.key === this.selectedKey);
  }
}
