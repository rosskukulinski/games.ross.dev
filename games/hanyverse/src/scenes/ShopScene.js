import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { getShopItems, getShopInfo } from '../data/shopData.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  init(data) {
    this.buildingData = data?.building || null;
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(300);

    // Get shop info
    this.shopInfo = getShopInfo(this.buildingData?.shopType);
    this.shopItems = getShopItems(this.buildingData?.shopType);

    this.createBackground();
    this.createUI();
    this.createItemGrid();

    console.log('ShopScene loaded:', this.buildingData?.name);
  }

  createBackground() {
    // Shop interior background
    this.cameras.main.setBackgroundColor('#F5DEB3');

    // Shelves decoration
    for (let i = 0; i < 3; i++) {
      this.add.rectangle(200 + i * 250, 300, 200, 20, 0x8B4513);
      this.add.rectangle(200 + i * 250, 450, 200, 20, 0x8B4513);
    }

    // Header
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.8);
  }

  createUI() {
    // Shop name
    this.add.text(GAME_WIDTH / 2, 30, this.buildingData?.name || 'Shop', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Welcome message
    this.add.text(GAME_WIDTH / 2, 65, this.shopInfo?.welcomeMessage || 'Welcome!', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Coin display
    this.coinIcon = this.add.image(GAME_WIDTH - 100, 40, 'coin-icon').setScale(1.3);
    this.coinText = this.add.text(GAME_WIDTH - 65, 40, `${this.playerState.coins}`, {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // Back button
    new Button(this, 60, 40, {
      text: '< Back',
      width: 100,
      height: 40,
      backgroundColor: 0x666666,
      backgroundColorPressed: 0x444444,
      fontSize: '14px',
      onClick: () => this.goBack()
    });

    // Inventory button
    new Button(this, GAME_WIDTH - 60, GAME_HEIGHT - 40, {
      text: 'Inventory',
      width: 100,
      height: 40,
      backgroundColor: 0x3498db,
      backgroundColorPressed: 0x2980b9,
      fontSize: '14px',
      onClick: () => this.showInventory()
    });
  }

  createItemGrid() {
    const startX = 120;
    const startY = 180;
    const itemWidth = 180;
    const itemHeight = 120;
    const cols = 4;
    const gap = 20;

    this.shopItems.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (itemWidth + gap);
      const y = startY + row * (itemHeight + gap);

      this.createItemCard(item, x, y, itemWidth, itemHeight);
    });
  }

  createItemCard(item, x, y, width, height) {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0xFFFFFF);
    bg.setStrokeStyle(2, 0xCCCCCC);
    container.add(bg);

    // Item emoji
    const emoji = this.add.text(0, -25, item.emoji, {
      fontSize: '40px'
    }).setOrigin(0.5);
    container.add(emoji);

    // Item name
    const name = this.add.text(0, 15, item.name, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(name);

    // Price
    const price = this.add.text(0, 35, `$${item.price}`, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(price);

    // Check if already owned
    const owned = this.isItemOwned(item.id);

    if (owned) {
      // Owned indicator
      const ownedText = this.add.text(width / 2 - 5, -height / 2 + 5, '✓', {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#4CAF50',
        fontStyle: 'bold'
      }).setOrigin(1, 0);
      container.add(ownedText);
      bg.setFillStyle(0xE8F5E9);
    }

    // Make interactive
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      if (!owned) bg.setFillStyle(0xF0F0F0);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(owned ? 0xE8F5E9 : 0xFFFFFF);
    });

    bg.on('pointerdown', () => {
      this.showItemDetails(item, owned);
    });
  }

  isItemOwned(itemId) {
    const inventory = this.playerState.inventory || [];
    return inventory.some(i => i.id === itemId);
  }

  showItemDetails(item, owned) {
    // Create overlay
    this.detailOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.detailOverlay.setInteractive();

    // Detail panel
    this.detailPanel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const panel = this.add.rectangle(0, 0, 350, 300, 0xFFFFFF);
    panel.setStrokeStyle(3, 0x333333);
    this.detailPanel.add(panel);

    // Item emoji (big)
    this.detailPanel.add(this.add.text(0, -90, item.emoji, {
      fontSize: '60px'
    }).setOrigin(0.5));

    // Item name
    this.detailPanel.add(this.add.text(0, -30, item.name, {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Description
    this.detailPanel.add(this.add.text(0, 10, item.description, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#666666'
    }).setOrigin(0.5));

    // Price
    this.detailPanel.add(this.add.text(0, 45, `Price: $${item.price}`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (owned) {
      // Already owned message
      this.detailPanel.add(this.add.text(0, 80, 'Already Owned!', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#2196F3'
      }).setOrigin(0.5));
    } else {
      // Buy button
      const canAfford = this.playerState.coins >= item.price;

      const buyBtn = new Button(this, 0, 100, {
        text: canAfford ? 'BUY' : 'Not enough $',
        width: 150,
        height: 50,
        backgroundColor: canAfford ? 0x4CAF50 : 0x999999,
        backgroundColorPressed: canAfford ? 0x388E3C : 0x999999,
        fontSize: '18px',
        onClick: () => {
          if (canAfford) this.buyItem(item);
        }
      });
      this.detailPanel.add(buyBtn);
    }

    // Close button
    const closeBtn = this.add.text(150, -130, '✕', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#666666'
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeDetails());
    this.detailPanel.add(closeBtn);

    // Animate in
    this.detailPanel.setScale(0.5);
    this.tweens.add({
      targets: this.detailPanel,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  buyItem(item) {
    // Check affordability again
    if (this.playerState.coins < item.price) return;

    // Deduct coins
    StorageManager.spendCoins(item.price);
    this.playerState.coins -= item.price;

    // Handle different item types
    if (item.destination) {
      // This is a flight ticket - travel immediately
      StorageManager.savePlayerState(this.playerState);
      this.closeDetails();
      this.travelTo(item);
      return;
    }

    if (item.activity) {
      // This is an activity (gym) - do it immediately
      StorageManager.savePlayerState(this.playerState);
      this.closeDetails();
      this.doActivity(item);
      return;
    }

    // Regular item - add to inventory
    if (!this.playerState.inventory) this.playerState.inventory = [];
    this.playerState.inventory.push({
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      purchasedAt: Date.now()
    });
    StorageManager.savePlayerState(this.playerState);

    // Update coin display
    this.coinText.setText(`${this.playerState.coins}`);

    // Show success
    this.showPurchaseSuccess(item);

    // Close details
    this.closeDetails();

    // Refresh item grid
    this.scene.restart();
  }

  travelTo(item) {
    // Show travel animation
    this.cameras.main.fadeOut(1000, 0, 0, 0);

    const destinationScenes = {
      'beach': 'BeachCityScene',
      'mountain': 'MountainCityScene',
      'space': 'SpaceCityScene'
    };

    const sceneKey = destinationScenes[item.destination] || 'BeachCityScene';

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, {
        avatar: this.avatarConfig,
        playerState: this.playerState,
        fromCity: 'main'
      });
    });
  }

  doActivity(item) {
    // Show activity animation
    this.showActivityAnimation(item);
  }

  showActivityAnimation(item) {
    // Create overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

    const container = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const bg = this.add.rectangle(0, 0, 350, 250, 0xFFFFFF);
    bg.setStrokeStyle(3, 0x333333);
    container.add(bg);

    // Activity emoji (big)
    container.add(this.add.text(0, -70, item.emoji, {
      fontSize: '80px'
    }).setOrigin(0.5));

    // Activity text
    container.add(this.add.text(0, 20, `${item.name}!`, {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    container.add(this.add.text(0, 55, 'You feel great!', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50'
    }).setOrigin(0.5));

    // Done button
    const doneBtn = new Button(this, 0, 100, {
      text: 'Done',
      width: 100,
      height: 40,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      onClick: () => {
        overlay.destroy();
        container.destroy();
        this.coinText.setText(`${this.playerState.coins}`);
      }
    });
    container.add(doneBtn);

    // Animate in
    container.setScale(0.5);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  showPurchaseSuccess(item) {
    const successText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Bought ${item.emoji} ${item.name}!`, {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50',
      fontStyle: 'bold',
      backgroundColor: '#FFFFFF',
      padding: { x: 20, y: 15 }
    }).setOrigin(0.5);
    successText.setDepth(1000);

    this.tweens.add({
      targets: successText,
      y: GAME_HEIGHT / 2 - 50,
      alpha: 0,
      delay: 1000,
      duration: 500,
      onComplete: () => successText.destroy()
    });

    // Flash screen
    this.cameras.main.flash(300, 76, 175, 80, false);
  }

  closeDetails() {
    if (this.detailPanel) {
      this.tweens.add({
        targets: this.detailPanel,
        scale: 0.5,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.detailPanel.destroy();
          this.detailOverlay.destroy();
        }
      });
    }
  }

  showInventory() {
    const inventory = this.playerState.inventory || [];

    // Create overlay
    this.invOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);
    this.invOverlay.setInteractive();

    // Inventory panel
    this.invPanel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const panel = this.add.rectangle(0, 0, 500, 400, 0xFFFFFF);
    panel.setStrokeStyle(3, 0x333333);
    this.invPanel.add(panel);

    // Title
    this.invPanel.add(this.add.text(0, -170, 'Your Inventory', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (inventory.length === 0) {
      this.invPanel.add(this.add.text(0, 0, 'No items yet!\nGo shopping!', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#999999',
        align: 'center'
      }).setOrigin(0.5));
    } else {
      // Show items in a grid
      const cols = 5;
      const size = 60;
      const startX = -(cols * size) / 2 + size / 2;

      inventory.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (size + 10);
        const y = -100 + row * (size + 10);

        const itemBg = this.add.rectangle(x, y, size, size, 0xF0F0F0);
        itemBg.setStrokeStyle(1, 0xCCCCCC);
        this.invPanel.add(itemBg);

        const emoji = this.add.text(x, y, item.emoji, {
          fontSize: '30px'
        }).setOrigin(0.5);
        this.invPanel.add(emoji);
      });
    }

    // Close button
    const closeBtn = new Button(this, 0, 160, {
      text: 'Close',
      width: 120,
      height: 45,
      backgroundColor: 0x666666,
      backgroundColorPressed: 0x444444,
      onClick: () => this.closeInventory()
    });
    this.invPanel.add(closeBtn);

    // Animate in
    this.invPanel.setScale(0.5);
    this.tweens.add({
      targets: this.invPanel,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  closeInventory() {
    if (this.invPanel) {
      this.tweens.add({
        targets: this.invPanel,
        scale: 0.5,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.invPanel.destroy();
          this.invOverlay.destroy();
        }
      });
    }
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
