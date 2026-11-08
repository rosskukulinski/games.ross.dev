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
    // Two columns of big swatches: a clumsy 5-year-old finger needs ~64px.
    const swatchSize = 64;
    const gap = 8;
    const columns = 2;
    const rows = Math.ceil(this.colors.length / columns);
    const totalWidth = columns * swatchSize + (columns - 1) * gap;
    const totalHeight = rows * swatchSize + (rows - 1) * gap;
    const startX = -totalWidth / 2 + swatchSize / 2;
    const startY = -totalHeight / 2 + swatchSize / 2;

    // Background panel
    const panelPadding = 10;
    this.panel = this.scene.add.graphics();
    this.panel.fillStyle(0xffffff, 0.2);
    this.panel.fillRoundedRect(
      -totalWidth / 2 - panelPadding,
      -totalHeight / 2 - panelPadding,
      totalWidth + panelPadding * 2,
      totalHeight + panelPadding * 2,
      15
    );
    this.add(this.panel);

    // Label
    const label = this.scene.add.text(0, -totalHeight / 2 - panelPadding - 16, 'Skin', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setShadow(1, 1, '#00000055', 2);
    this.add(label);

    this.colors.forEach((color, index) => {
      const x = startX + (index % columns) * (swatchSize + gap);
      const y = startY + Math.floor(index / columns) * (swatchSize + gap);
      const swatch = this.createSwatch(color, x, y, swatchSize);
      this.swatches.push({ key: color.key, hex: color.hex, container: swatch });
    });
  }

  createSwatch(color, x, y, size) {
    const container = this.scene.add.container(x, y);

    // Invisible full-size square so the container has real bounds / hit area
    container.add(this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0.001));

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
        swatch.container.setScale(1.08);
        if (animate) {
          this.scene.tweens.add({
            targets: swatch.container,
            scaleX: 1.15,
            scaleY: 1.15,
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
