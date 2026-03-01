import { STORAGE_KEYS } from '../utils/constants.js';

export class StorageManager {
  static saveAvatar(avatarConfig) {
    const data = {
      ...avatarConfig,
      savedAt: Date.now(),
      version: 1
    };
    try {
      localStorage.setItem(STORAGE_KEYS.AVATAR, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save avatar:', e);
      return false;
    }
  }

  static loadAvatar() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AVATAR);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load avatar:', e);
      return null;
    }
  }

  static hasExistingAvatar() {
    return localStorage.getItem(STORAGE_KEYS.AVATAR) !== null;
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  }

  static loadSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : this.getDefaultSettings();
    } catch (e) {
      console.error('Failed to load settings:', e);
      return this.getDefaultSettings();
    }
  }

  static getDefaultSettings() {
    return {
      soundEnabled: true,
      musicEnabled: true,
      musicVolume: 0.5,
      sfxVolume: 0.7
    };
  }

  static saveGameState(state) {
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify({
        ...state,
        savedAt: Date.now()
      }));
      return true;
    } catch (e) {
      console.error('Failed to save game state:', e);
      return false;
    }
  }

  static loadGameState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return null;
    }
  }

  static clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  static clearAvatar() {
    localStorage.removeItem(STORAGE_KEYS.AVATAR);
  }

  // Player state management
  static savePlayerState(playerState) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYER_STATE, JSON.stringify({
        ...playerState,
        savedAt: Date.now(),
        version: 1
      }));
      return true;
    } catch (e) {
      console.error('Failed to save player state:', e);
      return false;
    }
  }

  static loadPlayerState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYER_STATE);
      return data ? JSON.parse(data) : this.getDefaultPlayerState();
    } catch (e) {
      console.error('Failed to load player state:', e);
      return this.getDefaultPlayerState();
    }
  }

  static getDefaultPlayerState() {
    return {
      coins: 100,
      currentJob: null,
      customBuildings: [],
      inventory: [],
      totalEarned: 0,
      jobsCompleted: 0,
      buildingsCreated: 0
    };
  }

  static hasExistingPlayerState() {
    return localStorage.getItem(STORAGE_KEYS.PLAYER_STATE) !== null;
  }

  // Convenience methods for common operations
  static addCoins(amount) {
    const state = this.loadPlayerState();
    state.coins += amount;
    state.totalEarned += amount;
    return this.savePlayerState(state);
  }

  static spendCoins(amount) {
    const state = this.loadPlayerState();
    if (state.coins >= amount) {
      state.coins -= amount;
      this.savePlayerState(state);
      return true;
    }
    return false;
  }

  static getCoins() {
    return this.loadPlayerState().coins;
  }

  static setCurrentJob(job) {
    const state = this.loadPlayerState();
    state.currentJob = job;
    return this.savePlayerState(state);
  }

  static getCurrentJob() {
    return this.loadPlayerState().currentJob;
  }

  static quitJob() {
    const state = this.loadPlayerState();
    if (state.currentJob) {
      state.jobsCompleted++;
    }
    state.currentJob = null;
    return this.savePlayerState(state);
  }

  static saveCustomBuilding(building) {
    const state = this.loadPlayerState();
    state.customBuildings.push({
      ...building,
      createdAt: Date.now()
    });
    state.buildingsCreated++;
    return this.savePlayerState(state);
  }

  static getCustomBuildings() {
    return this.loadPlayerState().customBuildings;
  }

  static clearPlayerState() {
    localStorage.removeItem(STORAGE_KEYS.PLAYER_STATE);
  }

  // House furniture management
  static saveHouseFurniture(furniture) {
    try {
      localStorage.setItem(STORAGE_KEYS.HOUSE_FURNITURE, JSON.stringify({
        furniture: furniture,
        savedAt: Date.now()
      }));
      return true;
    } catch (e) {
      console.error('Failed to save house furniture:', e);
      return false;
    }
  }

  static getHouseFurniture() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HOUSE_FURNITURE);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.furniture || [];
      }
      return [];
    } catch (e) {
      console.error('Failed to load house furniture:', e);
      return [];
    }
  }

  static clearHouseFurniture() {
    localStorage.removeItem(STORAGE_KEYS.HOUSE_FURNITURE);
  }
}
