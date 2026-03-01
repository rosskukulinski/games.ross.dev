import Phaser from 'phaser';

export class GridSelector extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config) {
    super(scene, x, y);

    this.config = {
      items: config.items || [],
      columns: config.columns || 4,
      itemWidth: config.itemWidth || 60,
      itemHeight: config.itemHeight || 60,
      gap: config.gap || 10,
      onSelect: config.onSelect || (() => {}),
      showLabels: config.showLabels || false,
      title: config.title || null
    };

    this.selectedKey = null;
    this.itemContainers = [];

    this.createGrid();
    scene.add.existing(this);
  }

  createGrid() {
    const { items, columns, itemWidth, itemHeight, gap, title } = this.config;

    // Calculate dimensions
    const rows = Math.ceil(items.length / columns);
    const totalWidth = columns * itemWidth + (columns - 1) * gap;
    const totalHeight = rows * itemHeight + (rows - 1) * gap;

    const startX = -totalWidth / 2 + itemWidth / 2;
    const startY = title ? -totalHeight / 2 + itemHeight / 2 + 25 : -totalHeight / 2 + itemHeight / 2;

    // Title
    if (title) {
      const titleText = this.scene.add.text(0, startY - itemHeight / 2 - 20, title, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff'
      }).setOrigin(0.5);
      this.add(titleText);
    }

    // Background panel
    const panelPadding = 12;
    this.panel = this.scene.add.graphics();
    this.panel.fillStyle(0xffffff, 0.15);
    this.panel.fillRoundedRect(
      -totalWidth / 2 - panelPadding,
      startY - itemHeight / 2 - panelPadding,
      totalWidth + panelPadding * 2,
      totalHeight + panelPadding * 2,
      12
    );
    this.add(this.panel);

    // Create items
    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * (itemWidth + gap);
      const y = startY + row * (itemHeight + gap);

      const container = this.createItem(item, x, y);
      this.itemContainers.push({ key: item.key, container });
    });
  }

  createItem(item, x, y) {
    const { itemWidth, itemHeight, showLabels } = this.config;
    const container = this.scene.add.container(x, y);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.3);
    bg.fillRoundedRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight, 8);
    container.add(bg);
    container.bg = bg;

    // Item image/thumbnail
    if (item.texture && this.scene.textures.exists(item.texture)) {
      const image = this.scene.add.image(0, showLabels ? -5 : 0, item.texture);
      // Scale to fit
      const scale = Math.min(
        (itemWidth - 10) / image.width,
        (itemHeight - (showLabels ? 20 : 10)) / image.height
      );
      image.setScale(scale);
      container.add(image);
    }

    // Label
    if (showLabels && item.name) {
      const label = this.scene.add.text(0, itemHeight / 2 - 12, item.name, {
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff'
      }).setOrigin(0.5);
      container.add(label);
    }

    // Selection highlight
    const highlight = this.scene.add.graphics();
    highlight.lineStyle(3, 0xffd700, 1);
    highlight.strokeRoundedRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight, 8);
    highlight.setVisible(false);
    container.add(highlight);
    container.highlight = highlight;

    // Make interactive
    container.setSize(itemWidth, itemHeight);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.setSelected(item.key);
    });

    container.on('pointerover', () => {
      if (item.key !== this.selectedKey) {
        container.bg.clear();
        container.bg.fillStyle(0xffffff, 0.5);
        container.bg.fillRoundedRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight, 8);
      }
    });

    container.on('pointerout', () => {
      if (item.key !== this.selectedKey) {
        container.bg.clear();
        container.bg.fillStyle(0xffffff, 0.3);
        container.bg.fillRoundedRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight, 8);
      }
    });

    this.add(container);
    return container;
  }

  setSelected(key, animate = true) {
    this.selectedKey = key;
    const { itemWidth, itemHeight } = this.config;

    this.itemContainers.forEach(item => {
      const isSelected = item.key === key;
      item.container.highlight.setVisible(isSelected);

      // Update background
      item.container.bg.clear();
      item.container.bg.fillStyle(0xffffff, isSelected ? 0.7 : 0.3);
      item.container.bg.fillRoundedRect(-itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight, 8);

      if (animate && isSelected) {
        this.scene.tweens.add({
          targets: item.container,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          yoyo: true,
          ease: 'Quad.easeOut'
        });

        // Fire callback
        const selectedItem = this.config.items.find(i => i.key === key);
        if (selectedItem) {
          this.config.onSelect(selectedItem);
        }
      }
    });
  }

  setItems(newItems) {
    // Remove old items
    this.itemContainers.forEach(item => {
      item.container.destroy();
    });
    this.itemContainers = [];

    if (this.panel) {
      this.panel.destroy();
    }

    // Update config and recreate
    this.config.items = newItems;
    this.createGrid();

    // Reselect if possible
    if (this.selectedKey) {
      const stillExists = newItems.some(item => item.key === this.selectedKey);
      if (stillExists) {
        this.setSelected(this.selectedKey, false);
      } else {
        this.selectedKey = null;
      }
    }
  }

  getSelected() {
    return this.config.items.find(item => item.key === this.selectedKey);
  }
}
