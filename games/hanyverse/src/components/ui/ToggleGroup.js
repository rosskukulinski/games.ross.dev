import Phaser from 'phaser';

export class ToggleGroup extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options, onChange) {
    super(scene, x, y);

    this.options = options; // [{ key, icon, label }, ...]
    this.onChange = onChange || (() => {});
    this.selectedKey = null;
    this.buttons = [];

    this.createToggleGroup();
    scene.add.existing(this);
  }

  createToggleGroup() {
    const buttonWidth = 120;
    const buttonHeight = 50;
    const gap = 20;
    const totalWidth = this.options.length * buttonWidth + (this.options.length - 1) * gap;
    const startX = -totalWidth / 2 + buttonWidth / 2;

    // Background panel
    const panelPadding = 15;
    this.panel = this.scene.add.graphics();
    this.panel.fillStyle(0xffffff, 0.2);
    this.panel.fillRoundedRect(
      -totalWidth / 2 - panelPadding,
      -buttonHeight / 2 - panelPadding,
      totalWidth + panelPadding * 2,
      buttonHeight + panelPadding * 2,
      20
    );
    this.add(this.panel);

    this.options.forEach((option, index) => {
      const x = startX + index * (buttonWidth + gap);
      const button = this.createButton(option, x, buttonWidth, buttonHeight);
      this.buttons.push({ key: option.key, container: button });
    });
  }

  createButton(option, x, width, height) {
    const container = this.scene.add.container(x, 0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.3);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
    container.add(bg);
    container.bg = bg;

    // Icon
    if (option.icon && this.scene.textures.exists(option.icon)) {
      const icon = this.scene.add.image(-25, 0, option.icon);
      icon.setDisplaySize(35, 35);
      container.add(icon);
    }

    // Label
    const label = this.scene.add.text(15, 0, option.label, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    container.add(label);
    container.label = label;

    // Selection indicator
    const indicator = this.scene.add.graphics();
    indicator.lineStyle(3, 0xffd700, 1);
    indicator.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);
    indicator.setVisible(false);
    container.add(indicator);
    container.indicator = indicator;

    // Make interactive
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.setSelected(option.key);
    });

    this.add(container);
    return container;
  }

  setSelected(key, animate = true) {
    if (this.selectedKey === key) return;

    this.selectedKey = key;

    this.buttons.forEach(button => {
      const isSelected = button.key === key;

      // Update visual state
      button.container.indicator.setVisible(isSelected);

      // Update background
      button.container.bg.clear();
      button.container.bg.fillStyle(0xffffff, isSelected ? 0.8 : 0.3);
      button.container.bg.fillRoundedRect(
        -60, -25, 120, 50, 15
      );

      // Update text color
      button.container.label.setColor(isSelected ? '#333333' : '#ffffff');

      if (animate && isSelected) {
        this.scene.tweens.add({
          targets: button.container,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          yoyo: true,
          ease: 'Quad.easeOut'
        });
      }
    });

    // Only call onChange when animate is true (user interaction)
    if (animate) {
      this.onChange(key);
    }
  }

  getSelected() {
    return this.selectedKey;
  }
}
