import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class HouseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HouseScene' });
  }

  init(data) {
    this.buildingData = data?.building || null;
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(300);

    // Initialize furniture state
    this.placedFurniture = StorageManager.getHouseFurniture() || [];
    this.selectedFurniture = null;
    this.isPlacingMode = false;

    this.createBackground();
    this.createUI();
    this.createFurnitureDisplay();
    this.loadPlacedFurniture();

    console.log('HouseScene loaded');
  }

  createBackground() {
    // House interior background - cozy room
    this.cameras.main.setBackgroundColor('#FFF8DC'); // Cornsilk

    // Floor
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 160, 0xDEB887);

    // Floor pattern
    for (let i = 0; i < 10; i++) {
      this.add.rectangle(i * 110 + 55, GAME_HEIGHT - 80, 100, 150, 0xD2B48C, 0.5);
    }

    // Left wall
    this.add.rectangle(20, GAME_HEIGHT / 2, 40, GAME_HEIGHT, 0xFFE4C4);

    // Right wall
    this.add.rectangle(GAME_WIDTH - 20, GAME_HEIGHT / 2, 40, GAME_HEIGHT, 0xFFE4C4);

    // Window
    this.add.rectangle(200, 200, 150, 120, 0x87CEEB);
    this.add.rectangle(200, 200, 150, 120, 0xFFFFFF, 0).setStrokeStyle(8, 0x8B4513);
    this.add.rectangle(200, 200, 2, 120, 0x8B4513);
    this.add.rectangle(200, 200, 150, 2, 0x8B4513);

    // Another window
    this.add.rectangle(GAME_WIDTH - 200, 200, 150, 120, 0x87CEEB);
    this.add.rectangle(GAME_WIDTH - 200, 200, 150, 120, 0xFFFFFF, 0).setStrokeStyle(8, 0x8B4513);
    this.add.rectangle(GAME_WIDTH - 200, 200, 2, 120, 0x8B4513);
    this.add.rectangle(GAME_WIDTH - 200, 200, 150, 2, 0x8B4513);

    // Header
    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0x000000, 0.7);

    this.add.text(GAME_WIDTH / 2, 30, '🏠 Your House', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createUI() {
    // Back button
    new Button(this, 60, 30, {
      text: '< Back',
      width: 100,
      height: 40,
      backgroundColor: 0x666666,
      backgroundColorPressed: 0x444444,
      fontSize: '14px',
      onClick: () => this.goBack()
    });

    // Coin display
    this.add.image(GAME_WIDTH - 100, 30, 'coin-icon').setScale(1.2);
    this.coinText = this.add.text(GAME_WIDTH - 65, 30, `${this.playerState.coins}`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // Place Furniture button
    this.placeButton = new Button(this, GAME_WIDTH / 2 - 100, GAME_HEIGHT - 30, {
      text: '🪑 Place Furniture',
      width: 160,
      height: 45,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      fontSize: '16px',
      onClick: () => this.openFurniturePicker()
    });

    // Sleep button (only if bed is placed)
    this.sleepButton = new Button(this, GAME_WIDTH / 2 + 100, GAME_HEIGHT - 30, {
      text: '😴 Sleep',
      width: 120,
      height: 45,
      backgroundColor: 0x3498db,
      backgroundColorPressed: 0x2980b9,
      fontSize: '16px',
      onClick: () => this.goToSleep()
    });

    // Check if bed is placed to enable sleep
    this.updateSleepButton();
  }

  createFurnitureDisplay() {
    // Room area where furniture can be placed
    this.roomArea = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, GAME_WIDTH - 100, 400, 0xFFFFFF, 0);
    this.roomArea.setInteractive();

    // Click to place furniture when in placing mode
    this.roomArea.on('pointerdown', (pointer) => {
      if (this.isPlacingMode && this.selectedFurniture) {
        this.placeFurnitureAt(pointer.x, pointer.y);
      }
    });
  }

  loadPlacedFurniture() {
    // Load and display furniture from storage
    this.furnitureSprites = [];

    this.placedFurniture.forEach(item => {
      this.createFurnitureSprite(item);
    });
  }

  createFurnitureSprite(item) {
    const sprite = this.add.text(item.x, item.y, item.emoji, {
      fontSize: '60px'
    }).setOrigin(0.5);

    sprite.setInteractive({ draggable: true });
    sprite.itemData = item;

    // Drag to reposition
    sprite.on('drag', (pointer, dragX, dragY) => {
      sprite.x = dragX;
      sprite.y = dragY;
    });

    sprite.on('dragend', () => {
      // Update stored position
      item.x = sprite.x;
      item.y = sprite.y;
      this.saveFurniture();
    });

    // Double tap to remove
    sprite.on('pointerdown', () => {
      if (sprite.lastTap && Date.now() - sprite.lastTap < 300) {
        // Double tap - show remove option
        this.showRemoveOption(sprite, item);
      }
      sprite.lastTap = Date.now();
    });

    this.furnitureSprites.push(sprite);
    return sprite;
  }

  showRemoveOption(sprite, item) {
    // Create remove dialog
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    overlay.setInteractive();

    const dialog = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const bg = this.add.rectangle(0, 0, 300, 150, 0xFFFFFF);
    bg.setStrokeStyle(3, 0x333333);
    dialog.add(bg);

    dialog.add(this.add.text(0, -40, `Remove ${item.name}?`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Remove button
    const removeBtn = new Button(this, -60, 30, {
      text: 'Remove',
      width: 100,
      height: 40,
      backgroundColor: 0xE74C3C,
      backgroundColorPressed: 0xC0392B,
      fontSize: '14px',
      onClick: () => {
        this.removeFurniture(sprite, item);
        overlay.destroy();
        dialog.destroy();
      }
    });
    dialog.add(removeBtn);

    // Cancel button
    const cancelBtn = new Button(this, 60, 30, {
      text: 'Cancel',
      width: 100,
      height: 40,
      backgroundColor: 0x999999,
      backgroundColorPressed: 0x666666,
      fontSize: '14px',
      onClick: () => {
        overlay.destroy();
        dialog.destroy();
      }
    });
    dialog.add(cancelBtn);
  }

  removeFurniture(sprite, item) {
    // Remove from placed furniture
    const index = this.placedFurniture.findIndex(f => f.id === item.id && f.x === item.x && f.y === item.y);
    if (index > -1) {
      this.placedFurniture.splice(index, 1);
    }

    // Remove sprite
    const spriteIndex = this.furnitureSprites.indexOf(sprite);
    if (spriteIndex > -1) {
      this.furnitureSprites.splice(spriteIndex, 1);
    }
    sprite.destroy();

    this.saveFurniture();
    this.updateSleepButton();
  }

  openFurniturePicker() {
    // Get furniture from inventory
    const inventory = this.playerState.inventory || [];
    const furniture = inventory.filter(item => item.id.startsWith('furn-'));

    if (furniture.length === 0) {
      this.showMessage('No furniture! Visit the Furniture Store.');
      return;
    }

    // Create picker overlay
    this.pickerOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.pickerOverlay.setInteractive();

    this.pickerPanel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const panel = this.add.rectangle(0, 0, 500, 350, 0xFFFFFF);
    panel.setStrokeStyle(3, 0x333333);
    this.pickerPanel.add(panel);

    // Title
    this.pickerPanel.add(this.add.text(0, -140, 'Select Furniture to Place', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Furniture grid
    const cols = 5;
    const size = 70;
    const startX = -(cols * size) / 2 + size / 2;

    furniture.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (size + 10);
      const y = -60 + row * (size + 10);

      const itemBg = this.add.rectangle(x, y, size, size, 0xF0F0F0);
      itemBg.setStrokeStyle(2, 0xCCCCCC);
      itemBg.setInteractive({ useHandCursor: true });
      this.pickerPanel.add(itemBg);

      const emoji = this.add.text(x, y, item.emoji, {
        fontSize: '40px'
      }).setOrigin(0.5);
      this.pickerPanel.add(emoji);

      itemBg.on('pointerover', () => itemBg.setFillStyle(0xE8F5E9));
      itemBg.on('pointerout', () => itemBg.setFillStyle(0xF0F0F0));
      itemBg.on('pointerdown', () => {
        this.selectFurnitureToPlace(item);
        this.closePicker();
      });
    });

    // Close button
    const closeBtn = new Button(this, 0, 130, {
      text: 'Cancel',
      width: 120,
      height: 45,
      backgroundColor: 0x999999,
      backgroundColorPressed: 0x666666,
      onClick: () => this.closePicker()
    });
    this.pickerPanel.add(closeBtn);

    // Animate in
    this.pickerPanel.setScale(0.5);
    this.tweens.add({
      targets: this.pickerPanel,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  closePicker() {
    if (this.pickerPanel) {
      this.tweens.add({
        targets: this.pickerPanel,
        scale: 0.5,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.pickerPanel.destroy();
          this.pickerOverlay.destroy();
        }
      });
    }
  }

  selectFurnitureToPlace(item) {
    this.selectedFurniture = item;
    this.isPlacingMode = true;
    this.showMessage(`Tap where to place ${item.emoji}`);
  }

  placeFurnitureAt(x, y) {
    if (!this.selectedFurniture) return;

    // Check bounds
    if (y < 100 || y > GAME_HEIGHT - 80) {
      this.showMessage('Can\'t place there!');
      return;
    }

    // Create furniture item data
    const placedItem = {
      id: this.selectedFurniture.id,
      name: this.selectedFurniture.name,
      emoji: this.selectedFurniture.emoji,
      x: x,
      y: y,
      placedAt: Date.now()
    };

    // Add to placed furniture
    this.placedFurniture.push(placedItem);
    this.saveFurniture();

    // Create sprite
    this.createFurnitureSprite(placedItem);

    // Update sleep button
    this.updateSleepButton();

    // Reset placing mode
    this.selectedFurniture = null;
    this.isPlacingMode = false;

    // Play placement effect
    this.cameras.main.flash(200, 76, 175, 80, false);
  }

  saveFurniture() {
    StorageManager.saveHouseFurniture(this.placedFurniture);
  }

  updateSleepButton() {
    // Check if any bed is placed
    const hasBed = this.placedFurniture.some(item => item.id === 'furn-bed');

    if (this.sleepButton) {
      // Update button appearance based on bed availability
      if (!hasBed) {
        this.sleepButton.setDisabled(true);
      } else {
        this.sleepButton.setDisabled(false);
      }
    }
  }

  goToSleep() {
    // Check if bed exists
    const hasBed = this.placedFurniture.some(item => item.id === 'furn-bed');
    if (!hasBed) {
      this.showMessage('You need a bed to sleep!');
      return;
    }

    // Sleep animation
    this.cameras.main.fadeOut(1000, 0, 0, 50);

    this.time.delayedCall(1200, () => {
      // "Next day" effect
      this.cameras.main.fadeIn(1000, 255, 255, 200);

      // Show good morning message
      this.time.delayedCall(500, () => {
        this.showSleepResult();
      });
    });
  }

  showSleepResult() {
    const messages = [
      'Good morning! ☀️',
      'You slept well! 😊',
      'Rise and shine! 🌟',
      'Time for a new day! 🌈'
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);

    const dialog = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const bg = this.add.rectangle(0, 0, 350, 180, 0xFFFFFF);
    bg.setStrokeStyle(3, 0x333333);
    dialog.add(bg);

    dialog.add(this.add.text(0, -50, message, {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    dialog.add(this.add.text(0, 0, 'You feel refreshed!', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#666666'
    }).setOrigin(0.5));

    const okBtn = new Button(this, 0, 55, {
      text: 'OK',
      width: 100,
      height: 40,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      onClick: () => {
        overlay.destroy();
        dialog.destroy();
      }
    });
    dialog.add(okBtn);

    // Animate in
    dialog.setScale(0.5);
    this.tweens.add({
      targets: dialog,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  showMessage(text) {
    const msg = this.add.text(GAME_WIDTH / 2, 100, text, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: msg,
      alpha: 0,
      y: 80,
      delay: 2000,
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
