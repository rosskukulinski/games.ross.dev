import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { getJobsByBuilding } from '../data/jobsData.js';
import { StorageManager } from '../managers/StorageManager.js';
import { Button } from '../components/ui/Button.js';

export default class BuildingInteriorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BuildingInteriorScene' });
  }

  init(data) {
    this.buildingData = data?.building || null;
    this.avatarConfig = data?.avatar || null;
    this.playerState = data?.playerState || StorageManager.loadPlayerState();
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(300);

    // Route based on building type
    const buildingType = this.buildingData?.type;

    if (buildingType === 'shop') {
      // Go to shop scene
      this.scene.start('ShopScene', {
        building: this.buildingData,
        avatar: this.avatarConfig,
        playerState: this.playerState
      });
      return;
    }

    if (buildingType === 'house' || this.buildingData?.isPlayerHouse) {
      // Go to house scene
      this.scene.start('HouseScene', {
        building: this.buildingData,
        avatar: this.avatarConfig,
        playerState: this.playerState
      });
      return;
    }

    // Default: work building - show job selection
    this.createBackground();
    this.createNPC();
    this.createUI();

    console.log('BuildingInteriorScene loaded:', this.buildingData?.name);
  }

  createBackground() {
    // Interior background
    this.cameras.main.setBackgroundColor('#F5DEB3');

    // Floor
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 100, GAME_WIDTH, 200, 0x8B4513);

    // Counter
    this.add.rectangle(GAME_WIDTH / 2, 450, 300, 80, 0xA0522D);

    // Header
    this.add.rectangle(GAME_WIDTH / 2, 50, GAME_WIDTH, 100, 0x000000, 0.7);

    this.add.text(GAME_WIDTH / 2, 40, this.buildingData?.name || 'Building', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createNPC() {
    const npc = this.buildingData?.npc;
    if (!npc) return;

    // NPC sprite
    this.npcSprite = this.add.image(GAME_WIDTH / 2, 350, npc.texture);
    this.npcSprite.setScale(2.5);

    // NPC name
    this.add.text(GAME_WIDTH / 2, 420, npc.name, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    // Talk button
    this.talkButton = new Button(this, GAME_WIDTH / 2, 520, {
      text: '💬 TALK',
      width: 160,
      height: 55,
      backgroundColor: 0x4CAF50,
      backgroundColorPressed: 0x388E3C,
      fontSize: '20px',
      onClick: () => this.showJobDialog()
    });

    // Idle animation
    this.tweens.add({
      targets: this.npcSprite,
      y: 345,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createUI() {
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

    // Coin display
    this.add.image(GAME_WIDTH - 80, 40, 'coin-icon').setScale(1.2);
    this.add.text(GAME_WIDTH - 55, 40, `${this.playerState.coins}`, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
  }

  showJobDialog() {
    // Create dialog overlay
    this.dialogOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.dialogOverlay.setInteractive();

    // Dialog box
    this.dialogBox = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const boxBg = this.add.rectangle(0, 0, 400, 450, 0xFFFFFF);
    boxBg.setStrokeStyle(3, 0x333333);
    this.dialogBox.add(boxBg);

    // Dialog title
    this.dialogBox.add(this.add.text(0, -190, 'Want a Job?', {
      fontSize: '26px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Get available jobs
    const jobs = getJobsByBuilding(this.buildingData.id);

    // Create job buttons
    jobs.forEach((job, index) => {
      const yPos = -100 + index * 90;

      // Job card
      const jobBg = this.add.rectangle(0, yPos, 340, 75, 0xF5F5F5);
      jobBg.setStrokeStyle(2, 0xE0E0E0);
      jobBg.setInteractive({ useHandCursor: true });
      this.dialogBox.add(jobBg);

      // Job name
      this.dialogBox.add(this.add.text(-150, yPos - 15, job.name, {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#333333',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5));

      // Pay rate
      this.dialogBox.add(this.add.text(-150, yPos + 15, `$${job.payPerDay}/day`, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#4CAF50'
      }).setOrigin(0, 0.5));

      // Work button
      const workBtn = new Button(this, 110, yPos, {
        text: 'WORK',
        width: 100,
        height: 45,
        backgroundColor: 0x4CAF50,
        backgroundColorPressed: 0x388E3C,
        fontSize: '16px',
        onClick: () => this.selectJob(job)
      });
      this.dialogBox.add(workBtn);

      // Hover effects
      jobBg.on('pointerover', () => jobBg.setFillStyle(0xE8F5E9));
      jobBg.on('pointerout', () => jobBg.setFillStyle(0xF5F5F5));
    });

    // Close button
    const closeBtn = new Button(this, 0, 180, {
      text: 'Cancel',
      width: 120,
      height: 45,
      backgroundColor: 0x999999,
      backgroundColorPressed: 0x777777,
      fontSize: '16px',
      onClick: () => this.closeDialog()
    });
    this.dialogBox.add(closeBtn);

    // Animate in
    this.dialogBox.setScale(0.5);
    this.tweens.add({
      targets: this.dialogBox,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  selectJob(job) {
    // Save current job
    StorageManager.setCurrentJob({
      jobId: job.id,
      buildingId: this.buildingData.id,
      daysWorked: 0,
      payPerDay: job.payPerDay
    });

    this.closeDialog();

    this.time.delayedCall(200, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('JobWorkScene', {
          job: job,
          building: this.buildingData,
          avatar: this.avatarConfig,
          playerState: this.playerState
        });
      });
    });
  }

  closeDialog() {
    if (this.dialogBox) {
      this.tweens.add({
        targets: this.dialogBox,
        scale: 0.5,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.dialogBox.destroy();
          this.dialogOverlay.destroy();
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
