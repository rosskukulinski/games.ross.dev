import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { BUILDING_BLOCKS, DECORATIONS, BUILDING_CATEGORIES } from '../data/buildingsData.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';
import { TextInput } from '../components/ui/TextInput.js';

export default class BuildingEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BuildingEditorScene' });
  }

  init(data) {
    this.lotData = data?.lot || null;
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(300);

    // Initialize building state
    this.placedBlocks = [];
    this.placedDecos = [];
    this.selectedCategory = 'basic';
    this.buildingName = '';
    this.draggedItem = null;

    this.createBackground();
    this.createBuildingArea();
    this.createCategoryBar();
    this.createItemPalette();
    this.createUI();

    console.log('BuildingEditorScene loaded for lot:', this.lotData?.id);
  }

  createBackground() {
    // Sky gradient background
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Ground
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 100, GAME_WIDTH, 200, 0x7ec850);

    // Header
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.7);

    this.add.text(20, 20, 'Build Your Building!', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    // Name input
    this.add.text(20, 60, 'Name:', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    });

    this.nameInput = new TextInput(this, 180, 60, {
      placeholder: 'My Building',
      maxLength: 20,
      width: 200,
      height: 35,
      onChange: (name) => {
        this.buildingName = name;
      }
    });
  }

  createBuildingArea() {
    // Building canvas area
    this.buildingArea = this.add.container(GAME_WIDTH / 2, 350);

    // Grid background
    const gridSize = 60;
    const gridCols = 5;
    const gridRows = 4;

    for (let col = 0; col < gridCols; col++) {
      for (let row = 0; row < gridRows; row++) {
        const x = (col - gridCols / 2 + 0.5) * gridSize;
        const y = (row - gridRows / 2 + 0.5) * gridSize;
        const cell = this.add.rectangle(x, y, gridSize - 2, gridSize - 2, 0xFFFFFF, 0.2);
        cell.setStrokeStyle(1, 0xFFFFFF, 0.5);
        this.buildingArea.add(cell);
      }
    }

    // Make building area droppable
    this.buildingDropZone = this.add.zone(GAME_WIDTH / 2, 350, gridCols * gridSize, gridRows * gridSize);
    this.buildingDropZone.setRectangleDropZone(gridCols * gridSize, gridRows * gridSize);
  }

  createCategoryBar() {
    const barY = GAME_HEIGHT - 180;

    // Category bar background
    this.add.rectangle(GAME_WIDTH / 2, barY, GAME_WIDTH - 40, 50, 0x333333, 0.9);

    // Category buttons
    const startX = 80;
    const spacing = 100;

    BUILDING_CATEGORIES.forEach((cat, index) => {
      const x = startX + index * spacing;

      const btn = this.add.container(x, barY);

      const bg = this.add.rectangle(0, 0, 80, 40, cat.key === this.selectedCategory ? 0x4CAF50 : 0x666666);
      bg.setInteractive({ useHandCursor: true });
      btn.add(bg);

      const text = this.add.text(0, 0, cat.name, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff'
      }).setOrigin(0.5);
      btn.add(text);

      bg.on('pointerdown', () => {
        this.selectCategory(cat.key);
      });

      cat.button = btn;
      cat.bg = bg;
    });
  }

  selectCategory(categoryKey) {
    this.selectedCategory = categoryKey;

    // Update button states
    BUILDING_CATEGORIES.forEach(cat => {
      if (cat.bg) {
        cat.bg.setFillStyle(cat.key === categoryKey ? 0x4CAF50 : 0x666666);
      }
    });

    // Update item palette
    this.updateItemPalette();
  }

  createItemPalette() {
    this.paletteContainer = this.add.container(0, 0);
    this.updateItemPalette();
  }

  updateItemPalette() {
    // Clear existing palette
    this.paletteContainer.removeAll(true);

    const paletteY = GAME_HEIGHT - 100;
    const startX = 60;
    const spacing = 80;

    // Get items for current category
    let items = [];
    if (['basic', 'roof'].includes(this.selectedCategory)) {
      items = BUILDING_BLOCKS.filter(b => b.category === this.selectedCategory);
    } else {
      items = DECORATIONS.filter(d => d.category === this.selectedCategory);
    }

    items.forEach((item, index) => {
      const x = startX + index * spacing;

      // Item background
      const bg = this.add.rectangle(x, paletteY, 60, 60, 0xFFFFFF, 0.9);
      bg.setStrokeStyle(2, 0x333333);
      this.paletteContainer.add(bg);

      // Item sprite
      const sprite = this.add.image(x, paletteY, item.texture);
      sprite.setScale(0.8);
      sprite.setInteractive({ draggable: true, useHandCursor: true });
      sprite.itemData = item;
      this.paletteContainer.add(sprite);

      // Drag events
      sprite.on('dragstart', () => {
        sprite.setScale(1);
        sprite.setAlpha(0.8);
        this.draggedItem = { ...item, originalSprite: sprite };
      });

      sprite.on('drag', (pointer, dragX, dragY) => {
        sprite.x = dragX;
        sprite.y = dragY;
      });

      sprite.on('dragend', (pointer) => {
        // Check if dropped in building area
        if (this.isInBuildingArea(pointer.x, pointer.y)) {
          this.placeItem(item, pointer.x, pointer.y);
        }

        // Reset palette item position
        sprite.x = x;
        sprite.y = paletteY;
        sprite.setScale(0.8);
        sprite.setAlpha(1);
        this.draggedItem = null;
      });
    });
  }

  isInBuildingArea(x, y) {
    const bounds = this.buildingDropZone.getBounds();
    return bounds.contains(x, y);
  }

  placeItem(itemData, x, y) {
    // Snap to grid
    const gridSize = 60;
    const areaX = GAME_WIDTH / 2;
    const areaY = 350;

    const relativeX = x - areaX;
    const relativeY = y - areaY;

    const snappedX = Math.round(relativeX / gridSize) * gridSize;
    const snappedY = Math.round(relativeY / gridSize) * gridSize;

    // Create placed item
    const placedSprite = this.add.image(areaX + snappedX, areaY + snappedY, itemData.texture);
    placedSprite.setInteractive({ draggable: true });
    placedSprite.itemData = itemData;

    // Allow repositioning
    placedSprite.on('drag', (pointer, dragX, dragY) => {
      placedSprite.x = dragX;
      placedSprite.y = dragY;
    });

    placedSprite.on('dragend', (pointer) => {
      if (!this.isInBuildingArea(pointer.x, pointer.y)) {
        // Remove if dragged outside
        const index = this.placedBlocks.indexOf(placedSprite);
        if (index > -1) this.placedBlocks.splice(index, 1);
        placedSprite.destroy();
      } else {
        // Snap to grid
        const relX = pointer.x - areaX;
        const relY = pointer.y - areaY;
        placedSprite.x = areaX + Math.round(relX / gridSize) * gridSize;
        placedSprite.y = areaY + Math.round(relY / gridSize) * gridSize;
      }
    });

    this.placedBlocks.push(placedSprite);

    // Play place sound effect (visual feedback for now)
    this.tweens.add({
      targets: placedSprite,
      scale: { from: 1.2, to: 1 },
      duration: 100
    });
  }

  createUI() {
    // Done button
    this.doneButton = new Button(this, GAME_WIDTH - 80, 60, {
      text: 'DONE',
      width: 120,
      height: 45,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      onClick: () => this.finishBuilding()
    });

    // Cancel button
    this.cancelButton = new Button(this, GAME_WIDTH - 200, 60, {
      text: 'Cancel',
      width: 100,
      height: 45,
      backgroundColor: 0x999999,
      backgroundColorPressed: 0x666666,
      fontSize: '14px',
      onClick: () => this.goBack()
    });

    // Clear button
    this.clearButton = new Button(this, GAME_WIDTH - 80, GAME_HEIGHT - 180, {
      text: 'Clear',
      width: 80,
      height: 35,
      backgroundColor: 0xE74C3C,
      backgroundColorPressed: 0xC0392B,
      fontSize: '14px',
      onClick: () => this.clearBuilding()
    });
  }

  clearBuilding() {
    this.placedBlocks.forEach(sprite => sprite.destroy());
    this.placedBlocks = [];
  }

  finishBuilding() {
    if (this.placedBlocks.length === 0) {
      // Show error - must place at least one block
      this.showMessage('Place at least one block!');
      return;
    }

    // Create building data
    const buildingData = {
      lotId: this.lotData.id,
      name: this.buildingName || 'My Building',
      blocks: this.placedBlocks.map(sprite => ({
        key: sprite.itemData.key,
        x: sprite.x - GAME_WIDTH / 2,
        y: sprite.y - 350
      }))
    };

    // Save to storage
    StorageManager.saveCustomBuilding(buildingData);

    // Play poof animation
    this.playPoofAnimation(() => {
      // Return to town
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TownScene', {
          avatar: this.avatarConfig
        });
      });
    });
  }

  playPoofAnimation(callback) {
    // Create particles
    const centerX = GAME_WIDTH / 2;
    const centerY = 350;
    const colors = [0xFFFFFF, 0xFFE4B5, 0xFFF8DC, 0xFAFAD2];

    for (let i = 0; i < 30; i++) {
      const particle = this.add.circle(
        centerX + Phaser.Math.Between(-50, 50),
        centerY + Phaser.Math.Between(-50, 50),
        Phaser.Math.Between(5, 12),
        colors[Phaser.Math.Between(0, colors.length - 1)]
      );

      this.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-80, 80),
        y: particle.y + Phaser.Math.Between(-100, -30),
        alpha: 0,
        scale: 0,
        duration: 600 + Phaser.Math.Between(0, 300),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }

    // Flash effect
    this.cameras.main.flash(300, 255, 255, 255);

    this.time.delayedCall(700, callback);
  }

  showMessage(text) {
    const msg = this.add.text(GAME_WIDTH / 2, 150, text, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: '#E74C3C',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: msg,
      alpha: 0,
      y: 130,
      delay: 1500,
      duration: 300,
      onComplete: () => msg.destroy()
    });
  }

  goBack() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TownScene', {
        avatar: this.avatarConfig
      });
    });
  }
}
