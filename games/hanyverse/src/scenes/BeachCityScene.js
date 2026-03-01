import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class BeachCityScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BeachCityScene' });
  }

  init(data) {
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
    this.fromCity = data?.fromCity || 'main';
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(1000);

    this.createBackground();
    this.createActivities();
    this.createUI();

    console.log('BeachCityScene loaded');
  }

  createBackground() {
    // Sky gradient - bright blue
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Sun
    this.add.circle(GAME_WIDTH - 100, 100, 60, 0xFFD700);
    this.add.circle(GAME_WIDTH - 100, 100, 50, 0xFFF44F);

    // Clouds
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * 200;
      const y = 80 + Math.random() * 60;
      this.createCloud(x, y);
    }

    // Ocean
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 150, GAME_WIDTH, 300, 0x1E90FF);

    // Waves
    for (let i = 0; i < 8; i++) {
      const wave = this.add.ellipse(100 + i * 130, GAME_HEIGHT - 280, 150, 30, 0x4169E1, 0.5);
      this.tweens.add({
        targets: wave,
        x: wave.x + 20,
        duration: 1500 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Beach (sand)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 50, GAME_WIDTH, 100, 0xF5DEB3);

    // Palm trees
    this.createPalmTree(80, GAME_HEIGHT - 250);
    this.createPalmTree(GAME_WIDTH - 80, GAME_HEIGHT - 250);

    // Beach umbrellas
    this.createUmbrella(250, GAME_HEIGHT - 120, 0xFF6B6B);
    this.createUmbrella(500, GAME_HEIGHT - 120, 0x4ECDC4);
    this.createUmbrella(750, GAME_HEIGHT - 120, 0xFFE66D);

    // Title
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.5);
    this.add.text(GAME_WIDTH / 2, 40, '🏖️ Beach City', {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createCloud(x, y) {
    const cloud = this.add.container(x, y);
    cloud.add(this.add.ellipse(0, 0, 60, 40, 0xFFFFFF));
    cloud.add(this.add.ellipse(-25, 5, 40, 30, 0xFFFFFF));
    cloud.add(this.add.ellipse(25, 5, 50, 35, 0xFFFFFF));

    // Gentle float animation
    this.tweens.add({
      targets: cloud,
      x: x + 30,
      duration: 3000 + Math.random() * 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createPalmTree(x, y) {
    // Trunk
    this.add.rectangle(x, y + 60, 15, 120, 0x8B4513);

    // Leaves
    const leafColor = 0x228B22;
    this.add.ellipse(x - 40, y - 20, 80, 25, leafColor).setAngle(-30);
    this.add.ellipse(x + 40, y - 20, 80, 25, leafColor).setAngle(30);
    this.add.ellipse(x - 30, y - 40, 70, 20, leafColor).setAngle(-45);
    this.add.ellipse(x + 30, y - 40, 70, 20, leafColor).setAngle(45);
    this.add.ellipse(x, y - 50, 60, 20, leafColor);

    // Coconuts
    this.add.circle(x - 8, y - 10, 8, 0x8B4513);
    this.add.circle(x + 8, y - 10, 8, 0x8B4513);
  }

  createUmbrella(x, y, color) {
    // Pole
    this.add.rectangle(x, y + 30, 5, 60, 0x8B4513);

    // Umbrella top
    this.add.ellipse(x, y, 70, 35, color);
    this.add.ellipse(x, y - 5, 60, 30, Phaser.Display.Color.ValueToColor(color).brighten(20).color);
  }

  createActivities() {
    const activities = [
      { emoji: '🏄', name: 'Surf', x: 200, y: GAME_HEIGHT - 200 },
      { emoji: '🏐', name: 'Volleyball', x: 400, y: GAME_HEIGHT - 80 },
      { emoji: '🐚', name: 'Collect Shells', x: 600, y: GAME_HEIGHT - 80 },
      { emoji: '🍦', name: 'Ice Cream', x: 800, y: GAME_HEIGHT - 80 }
    ];

    activities.forEach(activity => {
      const btn = this.add.container(activity.x, activity.y);

      const bg = this.add.rectangle(0, 0, 100, 80, 0xFFFFFF, 0.9);
      bg.setStrokeStyle(2, 0x333333);
      bg.setInteractive({ useHandCursor: true });
      btn.add(bg);

      btn.add(this.add.text(0, -15, activity.emoji, {
        fontSize: '35px'
      }).setOrigin(0.5));

      btn.add(this.add.text(0, 25, activity.name, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#333333'
      }).setOrigin(0.5));

      bg.on('pointerdown', () => this.doBeachActivity(activity));
      bg.on('pointerover', () => bg.setFillStyle(0xE8F5E9, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(0xFFFFFF, 0.9));
    });
  }

  doBeachActivity(activity) {
    const messages = {
      'Surf': ['Cowabunga! 🌊', 'Gnarly waves!', 'Surf\'s up!'],
      'Volleyball': ['Spike! 🏐', 'Great game!', 'You scored!'],
      'Collect Shells': ['Found a pretty shell! 🐚', 'So many shells!', 'Beautiful!'],
      'Ice Cream': ['Yummy! 🍦', 'So refreshing!', 'Delicious!']
    };

    const msg = messages[activity.name][Math.floor(Math.random() * messages[activity.name].length)];
    this.showActivityMessage(activity.emoji, msg);
  }

  showActivityMessage(emoji, message) {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);

    const container = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const bg = this.add.rectangle(0, 0, 300, 200, 0xFFFFFF);
    bg.setStrokeStyle(3, 0x333333);
    container.add(bg);

    container.add(this.add.text(0, -50, emoji, {
      fontSize: '60px'
    }).setOrigin(0.5));

    container.add(this.add.text(0, 20, message, {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const okBtn = new Button(this, 0, 70, {
      text: 'Cool!',
      width: 100,
      height: 40,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      onClick: () => {
        overlay.destroy();
        container.destroy();
      }
    });
    container.add(okBtn);

    container.setScale(0.5);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  createUI() {
    // Back button (fly home)
    new Button(this, 60, 40, {
      text: '✈️ Home',
      width: 110,
      height: 40,
      backgroundColor: 0x3498db,
      backgroundColorPressed: 0x2980b9,
      fontSize: '14px',
      onClick: () => this.flyHome()
    });

    // Coin display
    this.add.image(GAME_WIDTH - 100, 40, 'coin-icon').setScale(1.2);
    this.add.text(GAME_WIDTH - 65, 40, `${this.playerState.coins}`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
  }

  flyHome() {
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TownScene', {
        avatar: this.avatarConfig
      });
    });
  }
}
