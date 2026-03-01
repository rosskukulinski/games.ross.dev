import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, DragonElement, DragonStats } from './gameStoreTypes';
import { tickStats } from '../engine/statDecay';
import { applyAction, CARE_ACTIONS } from '../engine/actions';
import { checkGrowth, isActionUnlocked } from '../engine/growth';
import { calculateLoveGain, tickLove } from '../engine/love';
import { canAfford } from '../engine/currency';
import { STARTING_CURRENCY, EGG_COSTS, DAILY_INCOME_COINS, INCOME_INTERVAL_MS } from '../engine/constants';
import * as wild from '../engine/wildDragons';

const DEFAULT_STATS: DragonStats = {
  hunger: 80,
  thirst: 80,
  happiness: 70,
  energy: 90,
  hygiene: 85,
  health: 90,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentScreen: 'title',
      lastSaveTimestamp: Date.now(),
      dragon: null,
      hatchingElement: null,
      hatchStartedAt: null,
      currency: STARTING_CURRENCY,
      wildDragons: [],
      lovedDragons: [],

      navigate: (screen) => set({ currentScreen: screen }),

      performAction: (actionId) => {
        const state = get();
        if (!state.dragon) return;

        const action = CARE_ACTIONS.find(a => a.id === actionId);
        if (!action) return;

        // Check stage unlock
        if (!isActionUnlocked(state.dragon.stage, actionId)) return;

        // Check cooldown
        const now = Date.now();
        const cooldownEnd = state.dragon.actionCooldowns[actionId] ?? 0;
        if (now < cooldownEnd) return;

        // Check cost
        if (action.currencyCost && !canAfford(state.currency, action.currencyCost)) return;

        const newStats = applyAction(state.dragon.stats, action.effects);
        const newCurrency = action.currencyCost ? state.currency - action.currencyCost : state.currency;
        const loveGain = calculateLoveGain(actionId, state.dragon.stats);
        const newLove = Math.min(100, state.dragon.love + loveGain);

        set({
          currency: newCurrency,
          dragon: {
            ...state.dragon,
            stats: newStats,
            love: newLove,
            actionCooldowns: {
              ...state.dragon.actionCooldowns,
              [actionId]: now + action.cooldownSeconds * 1000,
            },
          },
        });
      },

      tickGameLoop: (deltaSeconds) => {
        const state = get();
        if (!state.dragon || state.dragon.stage === 0) return;

        const newStats = tickStats(state.dragon.stats, deltaSeconds);
        const newLove = tickLove(state.dragon.love, newStats, deltaSeconds);
        const newCareMinutes = state.dragon.totalCareMinutes + deltaSeconds / 60;
        const newStage = checkGrowth(state.dragon.stage, newCareMinutes, newLove);

        set({
          dragon: {
            ...state.dragon,
            stats: newStats,
            love: newLove,
            totalCareMinutes: newCareMinutes,
            stage: newStage,
          },
          lastSaveTimestamp: Date.now(),
        });
      },

      buyEgg: (element: DragonElement) => {
        const state = get();
        const cost = EGG_COSTS[element];
        if (!canAfford(state.currency, cost)) return false;

        set({
          currency: state.currency - cost,
          hatchingElement: element,
          hatchStartedAt: Date.now(),
          currentScreen: 'hatching',
        });
        return true;
      },

      hatchEgg: (name: string) => {
        const state = get();
        if (!state.hatchingElement) return;

        set({
          dragon: {
            name,
            element: state.hatchingElement,
            stage: 1,
            stats: { ...DEFAULT_STATS },
            love: 0,
            totalCareMinutes: 0,
            actionCooldowns: {},
            bornAt: Date.now(),
          },
          hatchingElement: null,
          hatchStartedAt: null,
          currentScreen: 'main-care',
        });
      },

      addCurrency: (amount) => set(s => ({ currency: s.currency + amount })),

      spendCurrency: (amount) => {
        const state = get();
        if (!canAfford(state.currency, amount)) return false;
        set({ currency: state.currency - amount });
        return true;
      },

      releaseDragon: () => {
        const state = get();
        if (!state.dragon || state.dragon.stage < 5) return;

        const released = wild.releaseDragon(state.dragon.name, state.dragon.element);
        set({
          dragon: null,
          wildDragons: [...state.wildDragons, released],
          currentScreen: 'wild-dragons',
        });
      },

      retireDragon: () => {
        const state = get();
        if (!state.dragon || state.dragon.stage < 5 || state.dragon.love < 100) return;

        const loved = {
          id: `loved-${Date.now()}`,
          name: state.dragon.name,
          element: state.dragon.element,
          lastIncomeAt: Date.now(),
          totalEarned: 0,
        };
        set({
          dragon: null,
          lovedDragons: [...state.lovedDragons, loved],
          currentScreen: 'dragon-home',
        });
      },

      collectDailyIncome: () => {
        const state = get();
        const now = Date.now();
        let totalCollected = 0;

        const updated = state.lovedDragons.map(d => {
          const elapsed = now - d.lastIncomeAt;
          if (elapsed >= INCOME_INTERVAL_MS) {
            const periods = Math.floor(elapsed / INCOME_INTERVAL_MS);
            const earned = periods * DAILY_INCOME_COINS;
            totalCollected += earned;
            return { ...d, lastIncomeAt: d.lastIncomeAt + periods * INCOME_INTERVAL_MS, totalEarned: d.totalEarned + earned };
          }
          return d;
        });

        if (totalCollected > 0) {
          set({
            currency: state.currency + totalCollected,
            lovedDragons: updated,
          });
        }
        return totalCollected;
      },

      checkExpeditions: () => {
        const state = get();
        const updated = wild.checkExpeditions(state.wildDragons, Date.now());
        set({ wildDragons: updated });
      },

      collectPrize: (dragonId: string) => {
        const state = get();
        const dragon = state.wildDragons.find(d => d.id === dragonId);
        if (!dragon || dragon.status !== 'returned') return 0;

        const { coins, updatedDragon } = wild.collectPrize(dragon);
        set({
          currency: state.currency + coins,
          wildDragons: state.wildDragons.map(d => d.id === dragonId ? updatedDragon : d),
        });
        return coins;
      },

      resetGame: () => set({
        currentScreen: 'title',
        lastSaveTimestamp: Date.now(),
        dragon: null,
        hatchingElement: null,
        hatchStartedAt: null,
        currency: STARTING_CURRENCY,
        wildDragons: [],
        lovedDragons: [],
      }),
    }),
    {
      name: 'dragon-pet-save',
      partialize: (state) => ({
        currentScreen: state.currentScreen,
        lastSaveTimestamp: state.lastSaveTimestamp,
        dragon: state.dragon,
        hatchingElement: state.hatchingElement,
        hatchStartedAt: state.hatchStartedAt,
        currency: state.currency,
        wildDragons: state.wildDragons,
        lovedDragons: state.lovedDragons,
      }),
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          if (state.dragon && typeof state.dragon === 'object') {
            (state.dragon as Record<string, unknown>).love = 0;
          }
          state.lovedDragons = [];
        }
        return state as unknown as GameState;
      },
    }
  )
);
