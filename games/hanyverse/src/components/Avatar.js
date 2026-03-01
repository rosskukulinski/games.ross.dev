import Phaser from 'phaser';
import { SKIN_COLORS } from '../data/skinColors.js';
import { FACES } from '../data/faceData.js';
import { CLOTHING, HAIR_STYLES } from '../data/clothingData.js';

export class Avatar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    this.config = {
      gender: config.gender || 'girl',
      skinColor: config.skinColor || SKIN_COLORS[1].hex,
      face: config.face || 'happy',
      hair: config.hair || 'long',
      top: config.top || 'dress-flowers',
      bottom: config.bottom || null,
      ...config
    };

    // Layer references
    this.layers = {
      shadow: null,
      legs: null,
      body: null,
      bottom: null,
      top: null,
      arms: null,
      head: null,
      face: null,
      hair: null
    };

    this.buildAvatar();
    scene.add.existing(this);
  }

  buildAvatar() {
    // Create layers in order (back to front)
    this.createShadow();
    this.createLegs();
    this.createBody();
    this.createBottom();
    this.createTop();
    this.createArms();
    this.createHead();
    this.createFace();
    this.createHair();

    // Apply initial skin color
    this.applySkinColor();
  }

  createShadow() {
    const shadow = this.scene.add.ellipse(0, 85, 70, 20, 0x000000, 0.3);
    this.layers.shadow = shadow;
    this.add(shadow);
  }

  createLegs() {
    const legs = this.scene.add.image(0, 40, 'legs-base');
    legs.setOrigin(0.5, 0);
    this.layers.legs = legs;
    this.add(legs);
  }

  createBody() {
    const body = this.scene.add.image(0, -30, 'body-base');
    body.setOrigin(0.5, 0);
    this.layers.body = body;
    this.add(body);
  }

  createBottom() {
    if (this.config.bottom && !this.isWearingDress()) {
      const bottomData = CLOTHING.find(c => c.key === this.config.bottom);
      if (bottomData) {
        const bottom = this.scene.add.image(0, 25, bottomData.texture);
        bottom.setOrigin(0.5, 0);
        this.layers.bottom = bottom;
        this.add(bottom);
      }
    }
  }

  createTop() {
    if (this.config.top) {
      const topData = CLOTHING.find(c => c.key === this.config.top);
      if (topData) {
        const top = this.scene.add.image(0, -20, topData.texture);
        top.setOrigin(0.5, 0);
        this.layers.top = top;
        this.add(top);
      }
    }
  }

  createArms() {
    const arms = this.scene.add.image(0, -25, 'arms-base');
    arms.setOrigin(0.5, 0);
    this.layers.arms = arms;
    this.add(arms);
  }

  createHead() {
    const head = this.scene.add.image(0, -45, 'head-base');
    head.setOrigin(0.5, 0.5);
    this.layers.head = head;
    this.add(head);
  }

  createFace() {
    const faceData = FACES.find(f => f.key === this.config.face);
    if (faceData) {
      const face = this.scene.add.image(0, -45, faceData.texture);
      face.setOrigin(0.5, 0.5);
      this.layers.face = face;
      this.add(face);
    }
  }

  createHair() {
    const hairData = HAIR_STYLES.find(h => h.key === this.config.hair);
    if (hairData) {
      const hair = this.scene.add.image(0, -105, hairData.texture);
      hair.setOrigin(0.5, 0);
      this.layers.hair = hair;
      this.add(hair);
    }
  }

  isWearingDress() {
    const topData = CLOTHING.find(c => c.key === this.config.top);
    return topData?.type === 'dress';
  }

  applySkinColor() {
    const color = this.config.skinColor;
    if (this.layers.body) this.layers.body.setTint(color);
    if (this.layers.head) this.layers.head.setTint(color);
    if (this.layers.arms) this.layers.arms.setTint(color);
    if (this.layers.legs) this.layers.legs.setTint(color);
  }

  setSkinColor(hexColor, animate = true) {
    this.config.skinColor = hexColor;

    // Apply the skin color immediately
    this.applySkinColor();

    if (animate) {
      // Quick flash effect to show the change
      const skinParts = [this.layers.body, this.layers.head, this.layers.arms, this.layers.legs].filter(Boolean);
      skinParts.forEach(part => {
        part.setAlpha(0.7);
      });
      this.scene.tweens.add({
        targets: skinParts,
        alpha: 1,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    }
  }

  setGender(gender) {
    this.config.gender = gender;
    // Gender change might affect available clothing
    // For now, just update the config
  }

  updateFace(faceKey, animate = true) {
    this.config.face = faceKey;

    // Remove old face
    if (this.layers.face) {
      if (animate) {
        this.scene.tweens.add({
          targets: this.layers.face,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 100,
          onComplete: () => {
            this.layers.face.destroy();
            this.addNewFace(faceKey, animate);
          }
        });
      } else {
        this.layers.face.destroy();
        this.addNewFace(faceKey, false);
      }
    } else {
      this.addNewFace(faceKey, animate);
    }
  }

  addNewFace(faceKey, animate) {
    const faceData = FACES.find(f => f.key === faceKey);
    if (faceData) {
      const face = this.scene.add.image(0, -45, faceData.texture);
      face.setOrigin(0.5, 0.5);

      if (animate) {
        face.setAlpha(0);
        face.setScale(0.8);
        this.scene.tweens.add({
          targets: face,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: 'Back.easeOut'
        });
      }

      this.layers.face = face;
      // Insert face at correct position (after head)
      const headIndex = this.getIndex(this.layers.head);
      this.addAt(face, headIndex + 1);
    }
  }

  updateHair(hairKey, animate = true) {
    this.config.hair = hairKey;

    // Remove old hair
    if (this.layers.hair) {
      this.layers.hair.destroy();
    }

    const hairData = HAIR_STYLES.find(h => h.key === hairKey);
    if (hairData) {
      const hair = this.scene.add.image(0, -105, hairData.texture);
      hair.setOrigin(0.5, 0);

      if (animate) {
        hair.setAlpha(0);
        this.scene.tweens.add({
          targets: hair,
          alpha: 1,
          duration: 200
        });
      }

      this.layers.hair = hair;
      this.add(hair); // Add to top
    }
  }

  updateTop(topKey, animate = true) {
    this.config.top = topKey;

    // Remove old top
    if (this.layers.top) {
      this.layers.top.destroy();
      this.layers.top = null;
    }

    // If wearing a dress, remove bottom
    const topData = CLOTHING.find(c => c.key === topKey);
    if (topData?.type === 'dress' && this.layers.bottom) {
      this.layers.bottom.destroy();
      this.layers.bottom = null;
      this.config.bottom = null;
    }

    if (topData) {
      const top = this.scene.add.image(0, -20, topData.texture);
      top.setOrigin(0.5, 0);

      if (animate) {
        top.setAlpha(0);
        top.setScale(0.9);
        this.scene.tweens.add({
          targets: top,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Back.easeOut'
        });
      }

      this.layers.top = top;
      // Insert after bottom or body
      const insertAfter = this.layers.bottom || this.layers.body;
      const insertIndex = this.getIndex(insertAfter) + 1;
      this.addAt(top, insertIndex);
    }
  }

  updateBottom(bottomKey, animate = true) {
    // Don't add bottom if wearing a dress
    if (this.isWearingDress()) {
      return;
    }

    this.config.bottom = bottomKey;

    // Remove old bottom
    if (this.layers.bottom) {
      this.layers.bottom.destroy();
      this.layers.bottom = null;
    }

    if (bottomKey) {
      const bottomData = CLOTHING.find(c => c.key === bottomKey);
      if (bottomData) {
        const bottom = this.scene.add.image(0, 25, bottomData.texture);
        bottom.setOrigin(0.5, 0);

        if (animate) {
          bottom.setAlpha(0);
          this.scene.tweens.add({
            targets: bottom,
            alpha: 1,
            duration: 200
          });
        }

        this.layers.bottom = bottom;
        // Insert after body
        const bodyIndex = this.getIndex(this.layers.body);
        this.addAt(bottom, bodyIndex + 1);
      }
    }
  }

  getConfig() {
    return { ...this.config };
  }

  applyConfig(config) {
    if (config.gender) this.setGender(config.gender);
    if (config.skinColor) this.setSkinColor(config.skinColor, false);
    if (config.face) this.updateFace(config.face, false);
    if (config.hair) this.updateHair(config.hair, false);
    if (config.top) this.updateTop(config.top, false);
    if (config.bottom) this.updateBottom(config.bottom, false);
  }

  playIdleAnimation() {
    // Subtle breathing animation
    this.scene.tweens.add({
      targets: this,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  playSelectionAnimation() {
    // Bounce animation when item is selected
    this.scene.tweens.add({
      targets: this,
      y: this.y - 10,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  stopAnimations() {
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
  }
}
