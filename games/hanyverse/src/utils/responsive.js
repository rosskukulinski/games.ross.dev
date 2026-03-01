import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

export class ResponsiveLayout {
  constructor(scene) {
    this.scene = scene;
    this.baseWidth = GAME_WIDTH;
    this.baseHeight = GAME_HEIGHT;
  }

  get width() {
    return this.scene.cameras.main.width;
  }

  get height() {
    return this.scene.cameras.main.height;
  }

  get centerX() {
    return this.width / 2;
  }

  get centerY() {
    return this.height / 2;
  }

  // Convert percentage to actual X position
  x(percent) {
    return this.width * (percent / 100);
  }

  // Convert percentage to actual Y position
  y(percent) {
    return this.height * (percent / 100);
  }

  // Scale factor relative to base design
  get scale() {
    return Math.min(
      this.width / this.baseWidth,
      this.height / this.baseHeight
    );
  }

  // Get safe area insets (for notched phones)
  getSafeArea() {
    return {
      top: 44,    // Typical notch height
      bottom: 34, // Home indicator area
      left: 0,
      right: 0
    };
  }
}
