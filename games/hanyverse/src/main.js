import Phaser from 'phaser';
import { gameConfig } from './config.js';

const game = new Phaser.Game(gameConfig);

// Expose game globally for debugging
window.game = game;

// Handle visibility changes (mobile tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.sound.pauseAll();
  } else {
    game.sound.resumeAll();
  }
});

// Prevent pull-to-refresh on mobile
document.body.addEventListener('touchmove', (e) => {
  if (e.target.tagName !== 'INPUT') {
    e.preventDefault();
  }
}, { passive: false });
