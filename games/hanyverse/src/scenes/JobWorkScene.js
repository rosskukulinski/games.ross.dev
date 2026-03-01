import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { getJobById } from '../data/jobsData.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class JobWorkScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JobWorkScene' });
  }

  init(data) {
    this.jobData = data?.job || null;
    this.buildingData = data?.building || null;
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
    this.currentJob = StorageManager.getCurrentJob();
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(300);

    this.createBackground();
    this.createUI();

    console.log('JobWorkScene loaded:', this.jobData?.name);
  }

  createBackground() {
    // Work area background
    this.cameras.main.setBackgroundColor('#F5DEB3');

    // Work illustration (simple)
    const workArea = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 300, 200, 0xFFFFFF, 0.9);
    workArea.setStrokeStyle(3, 0x333333);

    // Job icon/illustration
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.getJobEmoji(), {
      fontSize: '80px'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.jobData?.name || 'Working', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  getJobEmoji() {
    const emojis = {
      'pizza-maker': '🍕',
      'waiter': '🍽️',
      'delivery': '🚗',
      'vet-assistant': '🐕',
      'nurse': '💉',
      'cashier': '💰',
      'teacher-assistant': '📚',
      'firefighter': '🚒',
      'stocker': '📦',
      'trainer': '💪',
      'librarian': '📖',
      'baker': '🥖'
    };
    return emojis[this.jobData?.id] || '💼';
  }

  createUI() {
    // Header
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.7);

    this.add.text(GAME_WIDTH / 2, 30, this.buildingData?.name || 'Work', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Day counter
    const daysWorked = this.currentJob?.daysWorked || 0;
    this.add.text(GAME_WIDTH / 2, 60, `Day ${daysWorked + 1}`, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Coin display
    this.add.image(GAME_WIDTH - 80, 40, 'coin-icon').setScale(1.2);
    this.coinText = this.add.text(GAME_WIDTH - 55, 40, `${this.playerState.coins}`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // Pay info
    const payPerDay = this.jobData?.payPerDay || 50;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, `Earn $${payPerDay} per shift`, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50'
    }).setOrigin(0.5);

    // WORK button - big and prominent
    this.workButton = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 160, {
      text: '💼 WORK',
      width: 200,
      height: 70,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      fontSize: '28px',
      onClick: () => this.doWork()
    });

    // Quit button
    this.quitButton = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 250, {
      text: 'Quit Job',
      width: 150,
      height: 50,
      backgroundColor: 0xE74C3C,
      backgroundColorPressed: 0xC0392B,
      fontSize: '18px',
      onClick: () => this.quitJob()
    });

    // Back button
    this.backButton = new Button(this, 60, 40, {
      text: '< Back',
      width: 100,
      height: 40,
      backgroundColor: 0x666666,
      backgroundColorPressed: 0x444444,
      fontSize: '14px',
      onClick: () => this.goBack()
    });
  }

  doWork() {
    const payPerDay = this.jobData?.payPerDay || 50;

    // Add coins
    StorageManager.addCoins(payPerDay);
    this.playerState.coins += payPerDay;

    // Update display
    this.coinText.setText(`${this.playerState.coins}`);

    // Update days worked
    if (this.currentJob) {
      this.currentJob.daysWorked++;
      StorageManager.setCurrentJob(this.currentJob);
    }

    // Show pay animation
    this.showPayAnimation(payPerDay);

    // Disable work button briefly
    this.workButton.setDisabled(true);
    this.time.delayedCall(1500, () => {
      this.workButton.setDisabled(false);
    });
  }

  showPayAnimation(amount) {
    // Floating +money text
    const payText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, `+$${amount}`, {
      fontSize: '36px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: payText,
      y: GAME_HEIGHT / 2,
      alpha: 0,
      scale: 1.5,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => payText.destroy()
    });

    // Coin bounce
    this.tweens.add({
      targets: this.coinText,
      scale: { from: 1, to: 1.3 },
      duration: 150,
      yoyo: true
    });

    // Screen flash
    this.cameras.main.flash(200, 76, 175, 80, false);
  }

  quitJob() {
    StorageManager.quitJob();
    this.goBack();
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
