import Phaser from 'phaser';
import { gameConfig } from './config.js';
import { StorageManager } from './managers/StorageManager.js';

const game = new Phaser.Game(gameConfig);

// Expose game globally for debugging
window.game = game;

// Read-only state getter for play-testing / debugging
window.__hanyverse = {
  state() {
    const scenes = game.scene.getScenes(true).map(s => s.scene.key);
    const avatarScene = game.scene.getScene('AvatarCreationScene');
    const town = game.scene.getScene('TownScene');
    const coins = StorageManager.getCoins();
    return {
      scenes,
      name: avatarScene?.avatarConfig?.name ?? null,
      coins,
      starterCoinsLeft: scenes.includes('TownScene') && town.starterCoins
        ? town.starterCoins.filter(c => !c.collected).map(c => ({ x: Math.round(c.x), y: Math.round(c.y) }))
        : null,
      player: scenes.includes('TownScene') && town.player
        ? { x: Math.round(town.player.x), y: Math.round(town.player.y) }
        : null,
      activeElement: document.activeElement?.tagName ?? null
    };
  }
};

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
