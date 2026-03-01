import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PreloaderScene from './scenes/PreloaderScene.js';
import AvatarCreationScene from './scenes/AvatarCreationScene.js';
import TownScene from './scenes/TownScene.js';
import BuildingInteriorScene from './scenes/BuildingInteriorScene.js';
import BuildingEditorScene from './scenes/BuildingEditorScene.js';
import JobWorkScene from './scenes/JobWorkScene.js';
import ShopScene from './scenes/ShopScene.js';
import HouseScene from './scenes/HouseScene.js';
import BeachCityScene from './scenes/BeachCityScene.js';
import MountainCityScene from './scenes/MountainCityScene.js';
import SpaceCityScene from './scenes/SpaceCityScene.js';

// Updated for iPad and computer screens
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const gameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#87CEEB',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 480,
      height: 360
    },
    max: {
      width: 1920,
      height: 1440
    }
  },
  scene: [BootScene, PreloaderScene, AvatarCreationScene, TownScene, BuildingInteriorScene, BuildingEditorScene, JobWorkScene, ShopScene, HouseScene, BeachCityScene, MountainCityScene, SpaceCityScene],
  input: {
    activePointers: 3,
  },
  dom: {
    createContainer: true
  },
  render: {
    pixelArt: false,
    antialias: true,
  }
};
