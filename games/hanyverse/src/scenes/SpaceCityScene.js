import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class SpaceCityScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SpaceCityScene' });
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
    this.createSpaceStation();
    this.createActivities();
    this.createUI();

    console.log('SpaceCityScene loaded');
  }

  createBackground() {
    // Deep space background
    this.cameras.main.setBackgroundColor('#0a0a2e');

    // Stars
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const size = Math.random() * 2 + 0.5;
      const alpha = 0.3 + Math.random() * 0.7;

      const star = this.add.circle(x, y, size, 0xFFFFFF, alpha);

      // Twinkle animation
      if (Math.random() > 0.7) {
        this.tweens.add({
          targets: star,
          alpha: alpha * 0.3,
          duration: 500 + Math.random() * 1000,
          yoyo: true,
          repeat: -1
        });
      }
    }

    // Nebula effects
    this.createNebula(200, 150, 0x8B008B, 150);
    this.createNebula(GAME_WIDTH - 200, 300, 0x4B0082, 120);
    this.createNebula(GAME_WIDTH / 2, 100, 0x00008B, 100);

    // Earth in the distance
    this.createEarth(150, GAME_HEIGHT - 150);

    // Moon
    this.add.circle(GAME_WIDTH - 100, 150, 40, 0xC0C0C0);
    this.add.circle(GAME_WIDTH - 110, 140, 8, 0xA0A0A0);
    this.add.circle(GAME_WIDTH - 85, 155, 6, 0xA0A0A0);
    this.add.circle(GAME_WIDTH - 95, 170, 5, 0x909090);

    // Title
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.7);
    this.add.text(GAME_WIDTH / 2, 40, '🚀 Space Station', {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createNebula(x, y, color, size) {
    const nebula = this.add.graphics();
    nebula.fillStyle(color, 0.15);
    nebula.fillCircle(x, y, size);
    nebula.fillStyle(color, 0.1);
    nebula.fillCircle(x + 30, y - 20, size * 0.7);
    nebula.fillCircle(x - 40, y + 30, size * 0.6);
  }

  createEarth(x, y) {
    // Earth
    const earth = this.add.circle(x, y, 80, 0x1E90FF);

    // Continents (simplified)
    const graphics = this.add.graphics();
    graphics.fillStyle(0x228B22, 1);

    // Land masses
    graphics.fillCircle(x - 20, y - 20, 25);
    graphics.fillCircle(x + 30, y + 10, 20);
    graphics.fillCircle(x - 10, y + 30, 15);

    // Clouds
    graphics.fillStyle(0xFFFFFF, 0.5);
    graphics.fillCircle(x - 40, y - 10, 15);
    graphics.fillCircle(x + 20, y - 35, 12);
    graphics.fillCircle(x + 45, y + 25, 10);

    // Slow rotation effect
    this.tweens.add({
      targets: [earth, graphics],
      angle: 360,
      duration: 60000,
      repeat: -1
    });
  }

  createSpaceStation() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2 + 50;

    // Main module
    this.add.rectangle(centerX, centerY, 200, 80, 0x808080);
    this.add.rectangle(centerX, centerY, 190, 70, 0xA0A0A0);

    // Windows
    for (let i = 0; i < 4; i++) {
      this.add.circle(centerX - 60 + i * 40, centerY, 12, 0x87CEEB);
      this.add.circle(centerX - 60 + i * 40, centerY, 10, 0xADD8E6);
    }

    // Solar panels
    this.add.rectangle(centerX - 180, centerY, 100, 40, 0x4169E1);
    this.add.rectangle(centerX + 180, centerY, 100, 40, 0x4169E1);

    // Panel grid lines
    const leftPanel = this.add.graphics();
    leftPanel.lineStyle(1, 0x000080);
    for (let i = 0; i < 5; i++) {
      leftPanel.moveTo(centerX - 230 + i * 25, centerY - 20);
      leftPanel.lineTo(centerX - 230 + i * 25, centerY + 20);
    }
    leftPanel.strokePath();

    const rightPanel = this.add.graphics();
    rightPanel.lineStyle(1, 0x000080);
    for (let i = 0; i < 5; i++) {
      rightPanel.moveTo(centerX + 130 + i * 25, centerY - 20);
      rightPanel.lineTo(centerX + 130 + i * 25, centerY + 20);
    }
    rightPanel.strokePath();

    // Connecting arms
    this.add.rectangle(centerX - 130, centerY, 10, 15, 0x606060);
    this.add.rectangle(centerX + 130, centerY, 10, 15, 0x606060);

    // Docking module (top)
    this.add.rectangle(centerX, centerY - 60, 60, 40, 0x707070);
    this.add.circle(centerX, centerY - 85, 15, 0x505050);

    // Antenna
    this.add.rectangle(centerX + 80, centerY - 50, 3, 40, 0xC0C0C0);
    this.add.circle(centerX + 80, centerY - 72, 8, 0xE0E0E0);

    // Floating astronaut
    this.createAstronaut(centerX + 250, centerY - 80);
  }

  createAstronaut(x, y) {
    const astronaut = this.add.container(x, y);

    // Body
    astronaut.add(this.add.ellipse(0, 10, 25, 35, 0xFFFFFF));

    // Helmet
    astronaut.add(this.add.circle(0, -15, 18, 0xFFFFFF));
    astronaut.add(this.add.circle(0, -15, 14, 0x4169E1, 0.8));

    // Visor reflection
    astronaut.add(this.add.ellipse(-5, -17, 4, 6, 0xFFFFFF, 0.5));

    // Arms
    astronaut.add(this.add.ellipse(-18, 5, 8, 15, 0xFFFFFF).setAngle(-30));
    astronaut.add(this.add.ellipse(18, 5, 8, 15, 0xFFFFFF).setAngle(30));

    // Legs
    astronaut.add(this.add.ellipse(-8, 35, 8, 18, 0xFFFFFF));
    astronaut.add(this.add.ellipse(8, 35, 8, 18, 0xFFFFFF));

    // Backpack
    astronaut.add(this.add.rectangle(0, 10, 20, 25, 0xD3D3D3).setDepth(-1));

    // Float animation
    this.tweens.add({
      targets: astronaut,
      y: y - 10,
      angle: 5,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createActivities() {
    const activities = [
      { emoji: '🔭', name: 'Stargaze', x: 150, y: GAME_HEIGHT - 80 },
      { emoji: '🛸', name: 'Zero-G Fun', x: 350, y: GAME_HEIGHT - 80 },
      { emoji: '🌍', name: 'View Earth', x: 550, y: GAME_HEIGHT - 80 },
      { emoji: '👽', name: 'Meet Aliens', x: 750, y: GAME_HEIGHT - 80 }
    ];

    activities.forEach(activity => {
      const btn = this.add.container(activity.x, activity.y);

      const bg = this.add.rectangle(0, 0, 100, 80, 0x1a1a4e, 0.9);
      bg.setStrokeStyle(2, 0x4169E1);
      bg.setInteractive({ useHandCursor: true });
      btn.add(bg);

      btn.add(this.add.text(0, -15, activity.emoji, {
        fontSize: '35px'
      }).setOrigin(0.5));

      btn.add(this.add.text(0, 25, activity.name, {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff'
      }).setOrigin(0.5));

      bg.on('pointerdown', () => this.doSpaceActivity(activity));
      bg.on('pointerover', () => bg.setStrokeStyle(3, 0x87CEEB));
      bg.on('pointerout', () => bg.setStrokeStyle(2, 0x4169E1));
    });
  }

  doSpaceActivity(activity) {
    const messages = {
      'Stargaze': ['So many stars! 🔭', 'Is that a galaxy?', 'Beautiful cosmos!'],
      'Zero-G Fun': ['Wheee! 🛸', 'Floating is fun!', 'Zero gravity!'],
      'View Earth': ['Home looks beautiful! 🌍', 'So blue and green!', 'Amazing view!'],
      'Meet Aliens': ['👽 Greetings, Earthling!', 'New friends!', 'They said hi!']
    };

    const msg = messages[activity.name][Math.floor(Math.random() * messages[activity.name].length)];
    this.showActivityMessage(activity.emoji, msg);
  }

  showActivityMessage(emoji, message) {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);

    const container = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const bg = this.add.rectangle(0, 0, 300, 200, 0x1a1a4e);
    bg.setStrokeStyle(3, 0x4169E1);
    container.add(bg);

    container.add(this.add.text(0, -50, emoji, {
      fontSize: '60px'
    }).setOrigin(0.5));

    container.add(this.add.text(0, 20, message, {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const okBtn = new Button(this, 0, 70, {
      text: 'Wow!',
      width: 100,
      height: 40,
      backgroundColor: 0x4169E1,
      backgroundColorPressed: 0x2E4A7D,
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
      text: '🚀 Home',
      width: 110,
      height: 40,
      backgroundColor: 0x4169E1,
      backgroundColorPressed: 0x2E4A7D,
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
