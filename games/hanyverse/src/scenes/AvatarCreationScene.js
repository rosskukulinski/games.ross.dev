import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { Avatar } from '../components/Avatar.js';
import { Button } from '../components/ui/Button.js';
import { ToggleGroup } from '../components/ui/ToggleGroup.js';
import { ColorPicker } from '../components/ui/ColorPicker.js';
import { GridSelector } from '../components/ui/GridSelector.js';
import { TextInput } from '../components/ui/TextInput.js';
import { StorageManager } from '../managers/StorageManager.js';
import { SKIN_COLORS } from '../data/skinColors.js';
import { FACES } from '../data/faceData.js';
import { getTopsByGender, getBottomsByGender, HAIR_STYLES } from '../data/clothingData.js';

export default class AvatarCreationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AvatarCreationScene' });
  }

  create() {
    this.layout = new ResponsiveLayout(this);

    // Initialize avatar configuration
    this.avatarConfig = this.getDefaultConfig();

    // Load existing avatar if available
    const savedAvatar = StorageManager.loadAvatar();
    if (savedAvatar) {
      this.avatarConfig = { ...this.avatarConfig, ...savedAvatar };
    }

    // Create all UI elements
    this.createBackground();
    this.createTitle();
    this.createGenderSelector();
    this.createAvatarPreview();
    this.createSkinColorPicker();
    this.createFaceSelector();
    this.createHairSelector();
    this.createClothingSelector();
    this.createNameInput();
    this.createPlayButton();

    // Apply saved config to UI
    this.applyConfigToUI();

    // Fade in
    this.cameras.main.fadeIn(300);
  }

  getDefaultConfig() {
    return {
      name: '',
      gender: 'girl',
      skinColor: SKIN_COLORS[1].hex,
      face: 'happy',
      hair: 'long',
      top: 'dress-flowers',
      bottom: null
    };
  }

  createBackground() {
    // Gradient-like background using rectangles
    const bgGradient = this.add.graphics();

    // Sky blue gradient
    bgGradient.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xE0F4FF, 0xE0F4FF, 1);
    bgGradient.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Decorative clouds
    this.createClouds();
  }

  createClouds() {
    const cloudPositions = [
      { x: 80, y: 100, scale: 0.8 },
      { x: 300, y: 60, scale: 0.5 },
      { x: 550, y: 90, scale: 0.7 },
      { x: 800, y: 70, scale: 0.6 },
      { x: 950, y: 110, scale: 0.5 }
    ];

    cloudPositions.forEach(pos => {
      const cloud = this.add.graphics();
      cloud.fillStyle(0xffffff, 0.6);
      cloud.fillCircle(0, 0, 25);
      cloud.fillCircle(20, -5, 20);
      cloud.fillCircle(40, 0, 25);
      cloud.fillCircle(20, 10, 18);
      cloud.setPosition(pos.x, pos.y);
      cloud.setScale(pos.scale);
    });
  }

  createTitle() {
    this.add.text(GAME_WIDTH / 2, 50, 'Create Your Avatar', {
      fontSize: '36px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setShadow(2, 2, '#000000', 4);
  }

  createGenderSelector() {
    this.genderToggle = new ToggleGroup(
      this,
      GAME_WIDTH / 2,
      110,
      [
        { key: 'girl', icon: 'gender-girl', label: 'Girl' },
        { key: 'boy', icon: 'gender-boy', label: 'Boy' }
      ],
      (gender) => this.onGenderChange(gender)
    );
    this.genderToggle.setSelected(this.avatarConfig.gender, false);
  }

  createAvatarPreview() {
    // Panel behind avatar - centered in the left-center area
    const avatarX = GAME_WIDTH / 2;
    const avatarY = 320;

    const panelGraphics = this.add.graphics();
    panelGraphics.fillStyle(0xffffff, 0.2);
    panelGraphics.fillRoundedRect(
      avatarX - 120,
      160,
      240,
      280,
      20
    );

    this.avatar = new Avatar(this, avatarX, avatarY, this.avatarConfig);
    this.avatar.setScale(1.4);
  }

  createSkinColorPicker() {
    this.skinPicker = new ColorPicker(
      this,
      80,
      320,
      SKIN_COLORS,
      (color) => this.onSkinColorChange(color)
    );
  }

  createFaceSelector() {
    this.faceSelector = new GridSelector(
      this,
      GAME_WIDTH - 120,
      240,
      {
        items: FACES,
        columns: 2,
        itemWidth: 55,
        itemHeight: 55,
        gap: 10,
        title: 'Face',
        onSelect: (face) => this.onFaceChange(face)
      }
    );
  }

  createHairSelector() {
    this.hairSelector = new GridSelector(
      this,
      GAME_WIDTH - 120,
      420,
      {
        items: HAIR_STYLES,
        columns: 3,
        itemWidth: 55,
        itemHeight: 55,
        gap: 10,
        title: 'Hair',
        onSelect: (hair) => this.onHairChange(hair)
      }
    );
  }

  createClothingSelector() {
    // Tops selector - positioned below avatar
    const tops = getTopsByGender(this.avatarConfig.gender);
    this.topsSelector = new GridSelector(
      this,
      GAME_WIDTH / 2 - 120,
      560,
      {
        items: tops,
        columns: 3,
        itemWidth: 60,
        itemHeight: 60,
        gap: 12,
        title: 'Tops',
        onSelect: (item) => this.onTopChange(item)
      }
    );

    // Bottoms selector
    const bottoms = getBottomsByGender(this.avatarConfig.gender);
    this.bottomsSelector = new GridSelector(
      this,
      GAME_WIDTH / 2 + 150,
      560,
      {
        items: bottoms,
        columns: 2,
        itemWidth: 60,
        itemHeight: 60,
        gap: 12,
        title: 'Bottoms',
        onSelect: (item) => this.onBottomChange(item)
      }
    );
  }

  createNameInput() {
    // Label
    this.add.text(GAME_WIDTH / 2, 670, 'Your Name', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.nameInput = new TextInput(
      this,
      GAME_WIDTH / 2,
      710,
      {
        placeholder: 'Enter your name',
        maxLength: 12,
        width: 300,
        height: 50,
        onChange: (name) => {
          this.avatarConfig.name = name;
        }
      }
    );
  }

  createPlayButton() {
    this.playButton = new Button(
      this,
      GAME_WIDTH - 150,
      710,
      {
        text: '♥ PLAY ♥',
        width: 200,
        height: 55,
        backgroundColor: 0x4ade80,
        backgroundColorPressed: 0x22c55e,
        onClick: () => this.onPlayClick()
      }
    );
  }

  // Event handlers
  onGenderChange(gender) {
    this.avatarConfig.gender = gender;
    this.avatar.setGender(gender);

    // Update clothing selectors with gender-appropriate items
    const tops = getTopsByGender(gender);
    const bottoms = getBottomsByGender(gender);

    this.topsSelector.setItems(tops);
    this.bottomsSelector.setItems(bottoms);

    // If current clothing isn't available for new gender, reset
    const topAvailable = tops.some(t => t.key === this.avatarConfig.top);
    if (!topAvailable && tops.length > 0) {
      this.onTopChange(tops[0]);
      this.topsSelector.setSelected(tops[0].key, false);
    }

    const bottomAvailable = bottoms.some(b => b.key === this.avatarConfig.bottom);
    if (!bottomAvailable && this.avatarConfig.bottom) {
      this.avatarConfig.bottom = null;
      this.avatar.updateBottom(null, false);
    }

    this.avatar.playSelectionAnimation();
  }

  onSkinColorChange(color) {
    this.avatarConfig.skinColor = color.hex;
    this.avatar.setSkinColor(color.hex);
    this.avatar.playSelectionAnimation();
  }

  onFaceChange(face) {
    this.avatarConfig.face = face.key;
    this.avatar.updateFace(face.key);
    this.avatar.playSelectionAnimation();
  }

  onHairChange(hair) {
    this.avatarConfig.hair = hair.key;
    this.avatar.updateHair(hair.key);
    this.avatar.playSelectionAnimation();
  }

  onTopChange(item) {
    this.avatarConfig.top = item.key;
    this.avatar.updateTop(item.key);

    // If it's a dress, clear bottom selection
    if (item.type === 'dress') {
      this.avatarConfig.bottom = null;
      // Visually deselect bottom
      this.bottomsSelector.selectedKey = null;
      this.bottomsSelector.setItems(getBottomsByGender(this.avatarConfig.gender));
    }

    this.avatar.playSelectionAnimation();
  }

  onBottomChange(item) {
    // Don't allow bottom selection if wearing a dress
    if (this.avatar.isWearingDress()) {
      this.showMessage('Remove dress first to select bottoms!');
      return;
    }

    this.avatarConfig.bottom = item.key;
    this.avatar.updateBottom(item.key);
    this.avatar.playSelectionAnimation();
  }

  onPlayClick() {
    // Validate name
    if (!this.avatarConfig.name || this.avatarConfig.name.trim().length === 0) {
      this.showMessage('Please enter your name!');
      this.nameInput.focus();
      return;
    }

    // Save avatar configuration
    StorageManager.saveAvatar(this.avatarConfig);

    // Transition to town scene
    this.avatar.stopAnimations();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TownScene', { avatar: this.avatarConfig });
    });
  }

  showMessage(text) {
    // Create temporary message
    const message = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, text, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6b6b',
      backgroundColor: '#ffffff',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    // Animate in and out
    this.tweens.add({
      targets: message,
      y: GAME_HEIGHT - 70,
      alpha: { from: 0, to: 1 },
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: message,
            alpha: 0,
            duration: 200,
            onComplete: () => message.destroy()
          });
        });
      }
    });
  }

  applyConfigToUI() {
    // Apply saved selections to UI components
    this.genderToggle.setSelected(this.avatarConfig.gender, false);
    this.skinPicker.setSelectedByHex(this.avatarConfig.skinColor, false);
    this.faceSelector.setSelected(this.avatarConfig.face, false);
    this.hairSelector.setSelected(this.avatarConfig.hair, false);

    if (this.avatarConfig.top) {
      this.topsSelector.setSelected(this.avatarConfig.top, false);
    }
    if (this.avatarConfig.bottom) {
      this.bottomsSelector.setSelected(this.avatarConfig.bottom, false);
    }
    if (this.avatarConfig.name) {
      this.nameInput.setValue(this.avatarConfig.name);
    }
  }
}
