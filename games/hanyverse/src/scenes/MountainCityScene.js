import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class MountainCityScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MountainCityScene' });
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
    this.createSnowfall();

    console.log('MountainCityScene loaded');
  }

  createBackground() {
    // Sky - winter blue
    this.cameras.main.setBackgroundColor('#B0C4DE');

    // Distant mountains
    this.createMountain(150, GAME_HEIGHT - 250, 300, 350, 0x6B8E9F);
    this.createMountain(400, GAME_HEIGHT - 220, 350, 320, 0x7B9DAD);
    this.createMountain(700, GAME_HEIGHT - 280, 400, 380, 0x5A7D8C);
    this.createMountain(GAME_WIDTH - 150, GAME_HEIGHT - 200, 280, 300, 0x6B8E9F);

    // Main mountain with snow
    this.createMountain(GAME_WIDTH / 2, GAME_HEIGHT - 150, 500, 400, 0x4A6670);

    // Snow caps
    const snowTriangle = this.add.triangle(
      GAME_WIDTH / 2, GAME_HEIGHT - 420,
      0, 150,
      120, 150,
      60, 0,
      0xFFFFFF
    );

    // Ground (snow)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 50, GAME_WIDTH, 100, 0xFFFAFA);

    // Pine trees
    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 120;
      const y = GAME_HEIGHT - 120 + Math.random() * 40;
      this.createPineTree(x, y, 0.6 + Math.random() * 0.4);
    }

    // Ski lodge
    this.createSkiLodge(GAME_WIDTH - 150, GAME_HEIGHT - 180);

    // Title
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.5);
    this.add.text(GAME_WIDTH / 2, 40, '🏔️ Mountain Town', {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createMountain(x, y, width, height, color) {
    this.add.triangle(
      x, y,
      0, height,
      width, height,
      width / 2, 0,
      color
    );
  }

  createPineTree(x, y, scale = 1) {
    const container = this.add.container(x, y);
    container.setScale(scale);

    // Trunk
    container.add(this.add.rectangle(0, 40, 12, 40, 0x5D4E37));

    // Tree layers
    container.add(this.add.triangle(0, -30, -35, 70, 35, 70, 0, 0, 0x2D5A27));
    container.add(this.add.triangle(0, -50, -30, 50, 30, 50, 0, 0, 0x3D7A37));
    container.add(this.add.triangle(0, -70, -25, 40, 25, 40, 0, 0, 0x4D8A47));

    // Snow on tree
    container.add(this.add.ellipse(0, -70, 15, 8, 0xFFFFFF));
    container.add(this.add.ellipse(-15, -50, 12, 6, 0xFFFFFF));
    container.add(this.add.ellipse(15, -50, 12, 6, 0xFFFFFF));
  }

  createSkiLodge(x, y) {
    // Main building
    this.add.rectangle(x, y + 20, 120, 80, 0x8B4513);

    // Roof
    this.add.triangle(x, y - 40, -70, 60, 70, 60, 0, 0, 0xA52A2A);

    // Snow on roof
    this.add.triangle(x, y - 45, -60, 50, 60, 50, 0, 0, 0xFFFFFF, 0.8);

    // Door
    this.add.rectangle(x, y + 35, 25, 45, 0x4A3520);

    // Windows
    this.add.rectangle(x - 35, y + 10, 25, 25, 0xADD8E6);
    this.add.rectangle(x + 35, y + 10, 25, 25, 0xADD8E6);

    // Chimney with smoke
    this.add.rectangle(x + 40, y - 50, 15, 30, 0x8B0000);

    // Smoke animation
    for (let i = 0; i < 3; i++) {
      const smoke = this.add.circle(x + 40, y - 70 - i * 15, 8 - i * 2, 0x888888, 0.5 - i * 0.15);
      this.tweens.add({
        targets: smoke,
        y: smoke.y - 30,
        alpha: 0,
        duration: 2000,
        delay: i * 500,
        repeat: -1
      });
    }
  }

  createSnowfall() {
    // Create falling snowflakes
    for (let i = 0; i < 50; i++) {
      const snowflake = this.add.circle(
        Math.random() * GAME_WIDTH,
        Math.random() * GAME_HEIGHT,
        2 + Math.random() * 3,
        0xFFFFFF,
        0.7
      );

      this.tweens.add({
        targets: snowflake,
        y: GAME_HEIGHT + 20,
        x: snowflake.x + (Math.random() - 0.5) * 100,
        duration: 3000 + Math.random() * 4000,
        repeat: -1,
        onRepeat: () => {
          snowflake.y = -20;
          snowflake.x = Math.random() * GAME_WIDTH;
        }
      });
    }
  }

  createActivities() {
    const activities = [
      { emoji: '⛷️', name: 'Ski', x: 200, y: GAME_HEIGHT - 80 },
      { emoji: '🏂', name: 'Snowboard', x: 350, y: GAME_HEIGHT - 80 },
      { emoji: '⛄', name: 'Build Snowman', x: 500, y: GAME_HEIGHT - 80 },
      { emoji: '☕', name: 'Hot Cocoa', x: 650, y: GAME_HEIGHT - 80 }
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

      bg.on('pointerdown', () => this.doMountainActivity(activity));
      bg.on('pointerover', () => bg.setFillStyle(0xE3F2FD, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(0xFFFFFF, 0.9));
    });
  }

  doMountainActivity(activity) {
    const messages = {
      'Ski': ['Whoosh! ⛷️', 'Down the slope!', 'What a run!'],
      'Snowboard': ['Shredding! 🏂', 'Epic tricks!', 'So cool!'],
      'Build Snowman': ['Hello Frosty! ⛄', 'Cute snowman!', 'Winter magic!'],
      'Hot Cocoa': ['So warm! ☕', 'Delicious!', 'Cozy vibes!']
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
      text: 'Awesome!',
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
