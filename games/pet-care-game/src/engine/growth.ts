import { GROWTH_STAGES } from './constants';

export function checkGrowth(currentStage: number, totalCareMinutes: number, love: number): number {
  const nextStage = GROWTH_STAGES[currentStage + 1];
  if (!nextStage) return currentStage;

  if (totalCareMinutes >= nextStage.requiredCareMinutes && love >= nextStage.requiredLove) {
    return currentStage + 1;
  }
  return currentStage;
}

export function getStageInfo(stage: number) {
  return GROWTH_STAGES[stage] ?? GROWTH_STAGES[0];
}

export function isActionUnlocked(stage: number, actionId: string): boolean {
  const info = getStageInfo(stage);
  return (info.unlockedActions as readonly string[]).includes(actionId);
}
