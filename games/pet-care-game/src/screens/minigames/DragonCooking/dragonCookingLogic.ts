export const INGREDIENTS = ['🥩', '🐟', '🌶️', '🧄', '🧅', '🥕', '🍄', '🫑'];

export interface Recipe {
  ingredients: string[];
}

export function generateRecipe(length: number): Recipe {
  const ingredients: string[] = [];
  for (let i = 0; i < length; i++) {
    ingredients.push(INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]);
  }
  return { ingredients };
}

export const GAME_TIME = 45;
export const STARTING_RECIPE_LENGTH = 3;

export function calculateReward(recipesCompleted: number): number {
  return Math.min(45, 20 + recipesCompleted * 5);
}
