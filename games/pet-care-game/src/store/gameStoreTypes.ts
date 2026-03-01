export interface DragonStats {
  hunger: number;
  thirst: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
}

export type DragonElement = 'fire' | 'ice' | 'nature' | 'storm';

export interface Dragon {
  name: string;
  element: DragonElement;
  stage: number;
  stats: DragonStats;
  love: number;
  totalCareMinutes: number;
  actionCooldowns: Record<string, number>;
  bornAt: number;
}

export interface LovedDragon {
  id: string;
  name: string;
  element: DragonElement;
  lastIncomeAt: number;
  totalEarned: number;
}

export interface WildDragon {
  id: string;
  name: string;
  element: string;
  releasedAt: number;
  nextReturnAt: number;
  totalPrizesCollected: number;
  status: 'exploring' | 'returned';
}

export type Screen =
  | 'title'
  | 'egg-shop'
  | 'hatching'
  | 'main-care'
  | 'wild-dragons'
  | 'dragon-home'
  | 'minigame-hub'
  | 'minigame-park'
  | 'minigame-jobs'
  | 'minigame-cage'
  | 'minigame-racing'
  | 'minigame-treasure'
  | 'minigame-cooking';

export interface GameState {
  currentScreen: Screen;
  lastSaveTimestamp: number;

  dragon: Dragon | null;
  hatchingElement: DragonElement | null;
  hatchStartedAt: number | null;

  currency: number;
  wildDragons: WildDragon[];
  lovedDragons: LovedDragon[];

  // Actions
  navigate: (screen: Screen) => void;
  performAction: (actionId: string) => void;
  tickGameLoop: (deltaSeconds: number) => void;
  buyEgg: (element: DragonElement) => boolean;
  hatchEgg: (name: string) => void;
  addCurrency: (amount: number) => void;
  spendCurrency: (amount: number) => boolean;
  releaseDragon: () => void;
  retireDragon: () => void;
  collectDailyIncome: () => number;
  checkExpeditions: () => void;
  collectPrize: (dragonId: string) => number;
  resetGame: () => void;
}
