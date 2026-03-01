import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

export default class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Create loading bar background
    const barBg = this.add.rectangle(centerX, centerY, 300, 30, 0x333333);
    barBg.setStrokeStyle(2, 0xffffff);

    // Create loading bar fill
    const barFill = this.add.rectangle(centerX - 145, centerY, 0, 22, 0x4ade80);
    barFill.setOrigin(0, 0.5);

    // Loading text
    const loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Progress text
    const progressText = this.add.text(centerX, centerY + 50, '0%', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Update loading bar on progress
    this.load.on('progress', (value) => {
      barFill.width = 290 * value;
      progressText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      loadingText.setText('Complete!');
    });

    // Generate placeholder assets
    this.createPlaceholderAssets();
  }

  createPlaceholderAssets() {
    // Create placeholder graphics for avatar parts
    // These will be replaced with actual art later

    // Body base (grayscale for tinting)
    const bodyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    bodyGraphics.fillStyle(0xcccccc, 1);
    bodyGraphics.fillRoundedRect(0, 0, 80, 100, 10);
    bodyGraphics.generateTexture('body-base', 80, 100);
    bodyGraphics.destroy();

    // Head (grayscale for tinting)
    const headGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    headGraphics.fillStyle(0xcccccc, 1);
    headGraphics.fillCircle(40, 40, 40);
    headGraphics.generateTexture('head-base', 80, 80);
    headGraphics.destroy();

    // Arms (grayscale for tinting) - positioned to hang naturally at sides
    const armsGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    armsGraphics.fillStyle(0xcccccc, 1);
    // Left arm - starts at shoulder, hangs down naturally
    armsGraphics.fillRoundedRect(0, 0, 18, 70, 8);
    // Right arm - starts at shoulder, hangs down naturally
    armsGraphics.fillRoundedRect(72, 0, 18, 70, 8);
    armsGraphics.generateTexture('arms-base', 90, 70);
    armsGraphics.destroy();

    // Legs (grayscale for tinting)
    const legsGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    legsGraphics.fillStyle(0xcccccc, 1);
    legsGraphics.fillRoundedRect(10, 0, 25, 60, 8);
    legsGraphics.fillRoundedRect(45, 0, 25, 60, 8);
    legsGraphics.generateTexture('legs-base', 80, 60);
    legsGraphics.destroy();

    // Face expressions
    this.createFaceTexture('face-happy', '😊');
    this.createFaceTexture('face-neutral', '😐');
    this.createFaceTexture('face-glasses', '🤓');
    this.createFaceTexture('face-wink', '😉');
    this.createFaceTexture('face-surprised', '😮');
    this.createFaceTexture('face-cool', '😎');

    // Hair styles
    this.createHairTexture('hair-short', 0x8B4513);
    this.createHairTexture('hair-long', 0x2C1810);
    this.createHairTexture('hair-pigtails', 0xFFD700);
    this.createHairTexture('hair-spiky', 0x1a1a1a);
    this.createHairTexture('hair-curly', 0x8B0000);
    this.createHairTexture('hair-rumi-braid', 0x1a1a1a);

    // Clothing - Tops
    this.createClothingTexture('top-shirt-plain', 0x3498db, 'shirt');
    this.createClothingTexture('top-shirt-smiley', 0xf1c40f, 'shirt');
    this.createClothingTexture('top-shirt-rad', 0xe74c3c, 'shirt');
    this.createClothingTexture('top-dress-flowers', 0xff69b4, 'dress');
    this.createClothingTexture('top-dress-plain', 0x9b59b6, 'dress');

    // Clothing - Bottoms
    this.createBottomTexture('bottom-pants-blue', 0x2980b9);
    this.createBottomTexture('bottom-shorts-red', 0xe74c3c);
    this.createBottomTexture('bottom-skirt-pink', 0xff69b4);

    // UI Elements
    this.createButtonTexture('button-play', 0x4ade80, 'PLAY');
    this.createButtonTexture('button-play-pressed', 0x22c55e, 'PLAY');

    // Gender icons
    this.createGenderIcon('gender-girl', 0xff69b4);
    this.createGenderIcon('gender-boy', 0x3498db);

    // Selection highlight
    const highlightGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    highlightGraphics.lineStyle(3, 0xffd700, 1);
    highlightGraphics.strokeRoundedRect(2, 2, 56, 56, 8);
    highlightGraphics.generateTexture('selection-highlight', 60, 60);
    highlightGraphics.destroy();

    // Color swatch base
    const swatchGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    swatchGraphics.fillStyle(0xffffff, 1);
    swatchGraphics.fillCircle(20, 20, 18);
    swatchGraphics.lineStyle(2, 0x333333, 1);
    swatchGraphics.strokeCircle(20, 20, 18);
    swatchGraphics.generateTexture('color-swatch', 40, 40);
    swatchGraphics.destroy();

    // Panel background
    const panelGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    panelGraphics.fillStyle(0xffffff, 0.9);
    panelGraphics.fillRoundedRect(0, 0, 100, 100, 12);
    panelGraphics.generateTexture('panel-bg', 100, 100);
    panelGraphics.destroy();

    // Town assets
    this.createTownAssets();
  }

  createTownAssets() {
    // Buildings
    this.createBuildingTexture('building-vet', 0x87CEEB, 'VET', '🐕');
    this.createBuildingTexture('building-hospital', 0xFFFFFF, '+', null, 0xFF0000);
    this.createBuildingTexture('building-pizza', 0xFFA500, 'PIZZA', '🍕');

    // Empty lot marker
    const lotGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    lotGraphics.fillStyle(0x90EE90, 1);
    lotGraphics.fillRoundedRect(0, 0, 100, 100, 10);
    lotGraphics.lineStyle(4, 0x228B22, 1);
    lotGraphics.strokeRoundedRect(2, 2, 96, 96, 10);
    // Plus sign
    lotGraphics.fillStyle(0x228B22, 1);
    lotGraphics.fillRect(45, 25, 10, 50);
    lotGraphics.fillRect(25, 45, 50, 10);
    lotGraphics.generateTexture('empty-lot', 100, 100);
    lotGraphics.destroy();

    // Road tiles
    const roadGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    roadGraphics.fillStyle(0x555555, 1);
    roadGraphics.fillRect(0, 0, 40, 40);
    roadGraphics.fillStyle(0xFFFFFF, 1);
    roadGraphics.fillRect(18, 0, 4, 8);
    roadGraphics.fillRect(18, 16, 4, 8);
    roadGraphics.fillRect(18, 32, 4, 8);
    roadGraphics.generateTexture('road-tile', 40, 40);
    roadGraphics.destroy();

    // Crosswalk
    const crosswalkGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    crosswalkGraphics.fillStyle(0x555555, 1);
    crosswalkGraphics.fillRect(0, 0, 40, 40);
    crosswalkGraphics.fillStyle(0xFFFFFF, 1);
    for (let i = 0; i < 5; i++) {
      crosswalkGraphics.fillRect(2 + i * 8, 5, 6, 30);
    }
    crosswalkGraphics.generateTexture('crosswalk', 40, 40);
    crosswalkGraphics.destroy();

    // Grass tile
    const grassGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    grassGraphics.fillStyle(0x7ec850, 1);
    grassGraphics.fillRect(0, 0, 40, 40);
    grassGraphics.generateTexture('grass-tile', 40, 40);
    grassGraphics.destroy();

    // NPC placeholder
    this.createNPCTexture('npc-vet', 0x4169E1, 'Dr');
    this.createNPCTexture('npc-doctor', 0xFFFFFF, 'Dr');
    this.createNPCTexture('npc-pete', 0xFF6347, 'P');

    // Coin icon
    const coinGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    coinGraphics.fillStyle(0xFFD700, 1);
    coinGraphics.fillCircle(15, 15, 14);
    coinGraphics.fillStyle(0xDAA520, 1);
    coinGraphics.fillCircle(15, 15, 10);
    coinGraphics.fillStyle(0xFFD700, 1);
    coinGraphics.fillCircle(15, 15, 8);
    // Dollar sign
    coinGraphics.fillStyle(0xDAA520, 1);
    coinGraphics.fillRect(13, 8, 4, 14);
    coinGraphics.generateTexture('coin-icon', 30, 30);
    coinGraphics.destroy();

    // Building blocks for editor
    this.createBlockTexture('block-cube', 0x8B4513, 60, 60);
    this.createBlockTexture('block-tall', 0xA0522D, 60, 90);
    this.createBlockTexture('block-wide', 0xD2691E, 90, 60);
    this.createRoofTexture('block-roof-flat', 0x696969);
    this.createRoofTexture('block-roof-pointed', 0x8B0000);

    // Decorations for editor
    this.createDecoTexture('deco-tree-small', 'tree', 40);
    this.createDecoTexture('deco-tree-large', 'tree', 60);
    this.createDecoTexture('deco-flowers', 'flowers', 30);
    this.createDecoTexture('deco-swing', 'swing', 50);
    this.createDecoTexture('deco-slide', 'slide', 50);
    this.createDecoTexture('deco-bench', 'bench', 40);

    // Interior background
    const interiorGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    interiorGraphics.fillStyle(0xF5DEB3, 1);
    interiorGraphics.fillRect(0, 0, 390, 844);
    // Floor
    interiorGraphics.fillStyle(0x8B4513, 1);
    interiorGraphics.fillRect(0, 600, 390, 244);
    // Counter
    interiorGraphics.fillStyle(0xA0522D, 1);
    interiorGraphics.fillRect(50, 450, 290, 80);
    interiorGraphics.generateTexture('interior-bg', 390, 844);
    interiorGraphics.destroy();

    // Talk button
    const talkBtnGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    talkBtnGraphics.fillStyle(0x4CAF50, 1);
    talkBtnGraphics.fillRoundedRect(0, 0, 120, 50, 25);
    talkBtnGraphics.fillStyle(0xFFFFFF, 0.3);
    talkBtnGraphics.fillRoundedRect(5, 5, 110, 20, 12);
    talkBtnGraphics.generateTexture('btn-talk', 120, 50);
    talkBtnGraphics.destroy();

    // Back button
    const backBtnGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    backBtnGraphics.fillStyle(0x666666, 1);
    backBtnGraphics.fillRoundedRect(0, 0, 80, 40, 20);
    // Arrow
    backBtnGraphics.fillStyle(0xFFFFFF, 1);
    backBtnGraphics.fillTriangle(15, 20, 30, 10, 30, 30);
    backBtnGraphics.fillRect(28, 15, 25, 10);
    backBtnGraphics.generateTexture('btn-back', 80, 40);
    backBtnGraphics.destroy();
  }

  createBuildingTexture(key, color, label, emoji, labelColor = 0x000000) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Building base
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(5, 20, 90, 75, 5);

    // Roof
    graphics.fillStyle(0x8B4513, 1);
    graphics.fillTriangle(50, 0, 0, 25, 100, 25);

    // Door
    graphics.fillStyle(0x8B4513, 1);
    graphics.fillRoundedRect(40, 55, 20, 40, { tl: 10, tr: 10, bl: 0, br: 0 });

    // Windows
    graphics.fillStyle(0x87CEEB, 1);
    graphics.fillRect(15, 35, 18, 18);
    graphics.fillRect(67, 35, 18, 18);

    // Window frames
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeRect(15, 35, 18, 18);
    graphics.strokeRect(67, 35, 18, 18);

    graphics.generateTexture(key, 100, 100);
    graphics.destroy();
  }

  createNPCTexture(key, shirtColor, initial) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Body
    graphics.fillStyle(shirtColor, 1);
    graphics.fillRoundedRect(15, 35, 30, 40, 5);

    // Head
    graphics.fillStyle(0xFFDBB4, 1);
    graphics.fillCircle(30, 22, 18);

    // Eyes
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(24, 20, 3);
    graphics.fillCircle(36, 20, 3);

    // Smile
    graphics.lineStyle(2, 0x000000, 1);
    graphics.beginPath();
    graphics.arc(30, 26, 6, 0, Math.PI, false);
    graphics.strokePath();

    // Hair
    graphics.fillStyle(0x4a3728, 1);
    graphics.fillRoundedRect(14, 5, 32, 15, 8);

    graphics.generateTexture(key, 60, 80);
    graphics.destroy();
  }

  createBlockTexture(key, color, width, height) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // 3D-ish effect
    const darkerColor = Phaser.Display.Color.IntegerToColor(color).darken(30).color;
    const lighterColor = Phaser.Display.Color.IntegerToColor(color).lighten(20).color;

    // Top face
    graphics.fillStyle(lighterColor, 1);
    graphics.fillRect(5, 0, width - 10, 10);

    // Front face
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 10, width, height - 10);

    // Side face (right edge shadow)
    graphics.fillStyle(darkerColor, 1);
    graphics.fillRect(width - 8, 10, 8, height - 10);

    // Outline
    graphics.lineStyle(2, 0x000000, 0.3);
    graphics.strokeRect(0, 0, width, height);

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  createRoofTexture(key, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    if (key.includes('pointed')) {
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(40, 0, 0, 40, 80, 40);
      graphics.lineStyle(2, 0x000000, 0.3);
      graphics.strokeTriangle(40, 0, 0, 40, 80, 40);
    } else {
      const darkerColor = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, 10, 80, 20);
      graphics.fillStyle(darkerColor, 1);
      graphics.fillRect(0, 0, 80, 12);
      graphics.lineStyle(2, 0x000000, 0.3);
      graphics.strokeRect(0, 0, 80, 30);
    }

    graphics.generateTexture(key, 80, 40);
    graphics.destroy();
  }

  createDecoTexture(key, type, size) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    if (type === 'tree') {
      // Trunk
      graphics.fillStyle(0x8B4513, 1);
      graphics.fillRect(size / 2 - 5, size * 0.6, 10, size * 0.4);
      // Foliage
      graphics.fillStyle(0x228B22, 1);
      graphics.fillCircle(size / 2, size * 0.35, size * 0.4);
      graphics.fillCircle(size / 2 - size * 0.2, size * 0.45, size * 0.25);
      graphics.fillCircle(size / 2 + size * 0.2, size * 0.45, size * 0.25);
    } else if (type === 'flowers') {
      // Multiple flowers
      const colors = [0xFF69B4, 0xFFFF00, 0xFF6347, 0x9370DB];
      for (let i = 0; i < 4; i++) {
        const x = 8 + (i % 2) * 14;
        const y = 8 + Math.floor(i / 2) * 14;
        graphics.fillStyle(colors[i], 1);
        graphics.fillCircle(x, y, 5);
        graphics.fillStyle(0xFFFF00, 1);
        graphics.fillCircle(x, y, 2);
      }
      // Stems
      graphics.fillStyle(0x228B22, 1);
      graphics.fillRect(6, 20, 2, 10);
      graphics.fillRect(20, 20, 2, 10);
    } else if (type === 'swing') {
      // Frame
      graphics.fillStyle(0x8B4513, 1);
      graphics.fillRect(5, 0, 5, 45);
      graphics.fillRect(40, 0, 5, 45);
      graphics.fillRect(5, 0, 40, 5);
      // Chains
      graphics.lineStyle(2, 0x808080, 1);
      graphics.lineBetween(15, 5, 15, 30);
      graphics.lineBetween(35, 5, 35, 30);
      // Seat
      graphics.fillStyle(0xA0522D, 1);
      graphics.fillRect(10, 30, 30, 8);
    } else if (type === 'slide') {
      // Ladder
      graphics.fillStyle(0x808080, 1);
      graphics.fillRect(5, 0, 5, 45);
      graphics.fillRect(5, 10, 15, 3);
      graphics.fillRect(5, 20, 15, 3);
      graphics.fillRect(5, 30, 15, 3);
      // Slide
      graphics.fillStyle(0xFF6347, 1);
      graphics.fillTriangle(20, 5, 45, 45, 20, 45);
    } else if (type === 'bench') {
      // Seat
      graphics.fillStyle(0x8B4513, 1);
      graphics.fillRect(0, 15, 40, 8);
      // Back
      graphics.fillRect(0, 5, 40, 5);
      // Legs
      graphics.fillRect(5, 23, 5, 12);
      graphics.fillRect(30, 23, 5, 12);
    }

    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  createFaceTexture(key, emoji) {
    // Create a simple face representation
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 0);
    graphics.fillRect(0, 0, 50, 50);
    graphics.generateTexture(key, 50, 50);
    graphics.destroy();

    // We'll overlay text for the emoji in the actual component
    // For now create simple eye/mouth patterns
    const faceGraphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Eyes
    faceGraphics.fillStyle(0x000000, 1);
    if (key === 'face-wink') {
      faceGraphics.fillCircle(15, 18, 4);
      faceGraphics.lineStyle(2, 0x000000);
      faceGraphics.lineBetween(30, 16, 38, 20);
    } else if (key === 'face-glasses' || key === 'face-cool') {
      // Glasses
      faceGraphics.lineStyle(2, 0x000000);
      faceGraphics.strokeCircle(15, 18, 8);
      faceGraphics.strokeCircle(35, 18, 8);
      faceGraphics.lineBetween(23, 18, 27, 18);
      if (key === 'face-cool') {
        faceGraphics.fillStyle(0x333333, 0.8);
        faceGraphics.fillCircle(15, 18, 6);
        faceGraphics.fillCircle(35, 18, 6);
      }
    } else {
      faceGraphics.fillCircle(15, 18, 4);
      faceGraphics.fillCircle(35, 18, 4);
    }

    // Mouth
    if (key === 'face-happy') {
      faceGraphics.lineStyle(2, 0x000000);
      faceGraphics.beginPath();
      faceGraphics.arc(25, 32, 10, 0, Math.PI, false);
      faceGraphics.strokePath();
    } else if (key === 'face-surprised') {
      faceGraphics.fillStyle(0x000000, 1);
      faceGraphics.fillCircle(25, 35, 6);
    } else {
      faceGraphics.lineStyle(2, 0x000000);
      faceGraphics.lineBetween(18, 35, 32, 35);
    }

    faceGraphics.generateTexture(key, 50, 50);
    faceGraphics.destroy();
  }

  createHairTexture(key, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    const highlightColor = Phaser.Display.Color.IntegerToColor(color).lighten(30).color;
    const shadowColor = Phaser.Display.Color.IntegerToColor(color).darken(20).color;

    if (key === 'hair-short') {
      // Base hair
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(5, 8, 70, 35, 18);
      // Highlight
      graphics.fillStyle(highlightColor, 0.5);
      graphics.fillRoundedRect(15, 12, 50, 12, 8);
      // Fringe/bangs
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(15, 30, 15, 10, 4);
      graphics.fillRoundedRect(35, 32, 12, 8, 4);
      graphics.fillRoundedRect(52, 30, 13, 10, 4);
    } else if (key === 'hair-long') {
      // Main hair mass
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(0, 5, 80, 40, 18);
      // Long sides flowing down
      graphics.fillRoundedRect(2, 35, 18, 55, 8);
      graphics.fillRoundedRect(60, 35, 18, 55, 8);
      // Highlight
      graphics.fillStyle(highlightColor, 0.4);
      graphics.fillRoundedRect(10, 10, 60, 15, 10);
      // Fringe
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(20, 35, 40, 12, 6);
    } else if (key === 'hair-pigtails') {
      // Top hair
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(8, 8, 64, 30, 14);
      // Left pigtail
      graphics.fillCircle(8, 32, 10);
      graphics.fillRoundedRect(0, 32, 16, 50, 7);
      graphics.fillCircle(8, 78, 8);
      // Right pigtail
      graphics.fillCircle(72, 32, 10);
      graphics.fillRoundedRect(64, 32, 16, 50, 7);
      graphics.fillCircle(72, 78, 8);
      // Hair ties
      graphics.fillStyle(0xff69b4, 1);
      graphics.fillCircle(8, 35, 5);
      graphics.fillCircle(72, 35, 5);
      // Highlight
      graphics.fillStyle(highlightColor, 0.4);
      graphics.fillRoundedRect(18, 12, 44, 12, 8);
    } else if (key === 'hair-spiky') {
      // Main spikes
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(40, 0, 28, 40, 52, 40);
      graphics.fillTriangle(22, 5, 10, 42, 34, 42);
      graphics.fillTriangle(58, 5, 46, 42, 70, 42);
      graphics.fillTriangle(8, 18, 0, 45, 20, 42);
      graphics.fillTriangle(72, 18, 60, 42, 80, 45);
      // Base
      graphics.fillRoundedRect(10, 35, 60, 15, 5);
      // Highlight on tips
      graphics.fillStyle(highlightColor, 0.5);
      graphics.fillTriangle(40, 5, 35, 20, 45, 20);
      graphics.fillTriangle(22, 10, 18, 22, 26, 22);
      graphics.fillTriangle(58, 10, 54, 22, 62, 22);
    } else if (key === 'hair-curly') {
      // Multiple curly layers
      graphics.fillStyle(color, 1);
      for (let i = 0; i < 5; i++) {
        graphics.fillCircle(8 + i * 16, 18, 14);
      }
      for (let i = 0; i < 4; i++) {
        graphics.fillCircle(16 + i * 16, 30, 12);
      }
      // Side curls
      graphics.fillCircle(8, 42, 10);
      graphics.fillCircle(72, 42, 10);
      graphics.fillCircle(5, 55, 8);
      graphics.fillCircle(75, 55, 8);
      // Highlights
      graphics.fillStyle(highlightColor, 0.4);
      graphics.fillCircle(20, 15, 6);
      graphics.fillCircle(50, 15, 6);
    } else if (key === 'hair-rumi-braid') {
      // Rumi style - long with side braid (KPop demon hunters inspired)
      // Top hair mass with side-swept look
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(0, 5, 80, 38, 16);
      // Flowing hair on right side
      graphics.fillRoundedRect(55, 35, 22, 55, 8);
      // Long braid on left side
      // Braid segments
      for (let i = 0; i < 6; i++) {
        const y = 38 + i * 12;
        const offset = i % 2 === 0 ? 2 : -2;
        graphics.fillStyle(color, 1);
        graphics.fillEllipse(12 + offset, y, 14, 10);
        // Braid shadow/depth
        graphics.fillStyle(shadowColor, 0.6);
        graphics.fillEllipse(12 + offset + 2, y + 2, 6, 6);
      }
      // Braid tie at end
      graphics.fillStyle(0xe74c3c, 1);
      graphics.fillCircle(12, 104, 5);
      // Tassel/ribbon
      graphics.fillStyle(0xe74c3c, 0.8);
      graphics.fillTriangle(12, 108, 6, 120, 18, 120);
      // Hair accessory (demon hunter inspired) - positioned at top of hair
      graphics.fillStyle(0xffd700, 1);
      graphics.fillCircle(55, 8, 5);
      graphics.fillStyle(0xe74c3c, 1);
      graphics.fillCircle(55, 8, 3);
      // Fringe/bangs sweeping to side
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(25, 35, 35, 12, 5);
      // Highlight
      graphics.fillStyle(highlightColor, 0.4);
      graphics.fillRoundedRect(30, 10, 45, 12, 8);
    }

    graphics.generateTexture(key, 80, 125);
    graphics.destroy();
  }

  createClothingTexture(key, color, type) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(color, 1);

    if (type === 'shirt') {
      // T-shirt shape - extended to overlap with pants
      graphics.fillRoundedRect(5, 5, 70, 85, 5);
      // Sleeves - wider to cover arms/shoulders
      graphics.fillRoundedRect(-5, 5, 25, 35, 5);
      graphics.fillRoundedRect(60, 5, 25, 35, 5);
      // Neckline
      graphics.fillStyle(0xffffff, 0.3);
      graphics.fillRoundedRect(30, 0, 20, 18, 8);

      // Add design based on key
      if (key === 'top-shirt-smiley') {
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(40, 40, 12);
        graphics.fillStyle(0xf1c40f, 1);
        graphics.fillCircle(40, 40, 10);
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(36, 38, 2);
        graphics.fillCircle(44, 38, 2);
        graphics.lineStyle(2, 0x000000);
        graphics.beginPath();
        graphics.arc(40, 41, 5, 0, Math.PI, false);
        graphics.strokePath();
      } else if (key === 'top-shirt-rad') {
        graphics.fillStyle(0xffffff, 1);
        // Simple "R" shape
        graphics.fillRect(32, 32, 3, 15);
        graphics.fillRect(35, 32, 8, 3);
        graphics.fillRect(35, 38, 8, 3);
        graphics.fillRect(40, 41, 5, 6);
      }
    } else if (type === 'dress') {
      // Dress shape - starts higher to cover shoulders
      graphics.fillRoundedRect(8, 5, 64, 45, 5);
      // Skirt part (trapezoid-like)
      graphics.fillTriangle(5, 50, 40, 50, 0, 95);
      graphics.fillTriangle(75, 50, 40, 50, 80, 95);
      graphics.fillRect(0, 50, 80, 45);
      // Sleeves - wider to cover shoulders
      graphics.fillRoundedRect(-2, 5, 20, 28, 5);
      graphics.fillRoundedRect(62, 5, 20, 28, 5);

      // Add flowers for flower dress
      if (key === 'top-dress-flowers') {
        graphics.fillStyle(0xffff00, 1);
        this.drawFlower(graphics, 25, 60);
        this.drawFlower(graphics, 55, 70);
        this.drawFlower(graphics, 40, 85);
      }
    }

    graphics.generateTexture(key, 80, 100);
    graphics.destroy();
  }

  drawFlower(graphics, x, y) {
    const petalColor = 0xffffff;
    graphics.fillStyle(petalColor, 0.8);
    graphics.fillCircle(x - 5, y, 4);
    graphics.fillCircle(x + 5, y, 4);
    graphics.fillCircle(x, y - 5, 4);
    graphics.fillCircle(x, y + 5, 4);
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(x, y, 3);
  }

  createBottomTexture(key, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(color, 1);

    if (key.includes('pants')) {
      // Pants shape - longer to fully cover legs
      graphics.fillRect(10, 0, 60, 25);
      graphics.fillRoundedRect(10, 20, 28, 60, 5);
      graphics.fillRoundedRect(42, 20, 28, 60, 5);
    } else if (key.includes('shorts')) {
      // Shorts shape - slightly longer
      graphics.fillRect(10, 0, 60, 18);
      graphics.fillRoundedRect(10, 12, 28, 35, 5);
      graphics.fillRoundedRect(42, 12, 28, 35, 5);
    } else if (key.includes('skirt')) {
      // Skirt shape - longer
      graphics.fillRect(10, 0, 60, 12);
      graphics.fillTriangle(5, 12, 40, 12, 0, 55);
      graphics.fillTriangle(75, 12, 40, 12, 80, 55);
      graphics.fillRect(0, 12, 80, 43);
    }

    graphics.generateTexture(key, 80, 80);
    graphics.destroy();
  }

  createButtonTexture(key, color, text) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Shadow
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillRoundedRect(4, 4, 180, 60, 30);

    // Button body
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(0, 0, 180, 60, 30);

    // Highlight
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRoundedRect(10, 5, 160, 20, 15);

    graphics.generateTexture(key, 184, 64);
    graphics.destroy();
  }

  createGenderIcon(key, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Background circle
    graphics.fillStyle(color, 0.3);
    graphics.fillCircle(30, 30, 28);

    // Icon circle
    graphics.fillStyle(color, 1);
    graphics.fillCircle(30, 30, 22);

    // Simple figure
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(30, 22, 8); // Head

    if (key === 'gender-girl') {
      // Dress shape
      graphics.fillTriangle(30, 28, 20, 48, 40, 48);
    } else {
      // Pants shape
      graphics.fillRect(24, 28, 12, 10);
      graphics.fillRect(24, 36, 5, 12);
      graphics.fillRect(31, 36, 5, 12);
    }

    graphics.generateTexture(key, 60, 60);
    graphics.destroy();
  }

  create() {
    // Short delay to show "Complete!" then transition
    this.time.delayedCall(300, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('AvatarCreationScene');
      });
    });
  }
}
