import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load minimal assets needed for the loading screen
    // For now, we'll use graphics primitives instead of images
  }

  create() {
    // Check for WebGL support
    if (this.sys.game.renderer.type === Phaser.CANVAS) {
      console.log('Running in Canvas mode');
    } else {
      console.log('Running in WebGL mode');
    }

    // Proceed to preloader
    this.scene.start('PreloaderScene');
  }
}
