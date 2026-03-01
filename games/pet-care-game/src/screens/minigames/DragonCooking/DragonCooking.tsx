import { useState, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { INGREDIENTS, generateRecipe, calculateReward, GAME_TIME, STARTING_RECIPE_LENGTH } from './dragonCookingLogic';
import type { Recipe } from './dragonCookingLogic';
import styles from './DragonCooking.module.css';

export function DragonCooking() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(GAME_TIME);

  const [gameStarted, setGameStarted] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recipesCompleted, setRecipesCompleted] = useState(0);
  const [recipeLength, setRecipeLength] = useState(STARTING_RECIPE_LENGTH);
  const [shake, setShake] = useState(false);
  const [reward, setReward] = useState(0);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setRecipe(generateRecipe(STARTING_RECIPE_LENGTH));
    setCurrentIndex(0);
    setRecipesCompleted(0);
    setRecipeLength(STARTING_RECIPE_LENGTH);
    setReward(0);
    start();
  }, [start]);

  const handleIngredient = useCallback((ingredient: string) => {
    if (!isRunning || !recipe) return;

    if (recipe.ingredients[currentIndex] === ingredient) {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= recipe.ingredients.length) {
        // Recipe complete!
        const newCompleted = recipesCompleted + 1;
        setRecipesCompleted(newCompleted);
        const newLength = Math.min(6, recipeLength + (newCompleted % 2 === 0 ? 1 : 0));
        setRecipeLength(newLength);
        setRecipe(generateRecipe(newLength));
        setCurrentIndex(0);
      } else {
        setCurrentIndex(nextIndex);
      }
    } else {
      // Wrong! Restart current recipe
      setShake(true);
      setCurrentIndex(0);
      setTimeout(() => setShake(false), 400);
    }
  }, [isRunning, recipe, currentIndex, recipesCompleted, recipeLength]);

  if ((isFinished) && gameStarted && reward === 0) {
    const r = calculateReward(recipesCompleted);
    setReward(r);
    addCurrency(r);
  }

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>Dragon Cooking</h2>
          <p>Follow the recipe — tap ingredients in order!</p>
          <p className={styles.tip}>Recipes get longer as you cook more. Wrong tap restarts the recipe!</p>
          <button className={styles.startBtn} onClick={startGame}>Cook!</button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className={styles.screen}>
        <div className={styles.results}>
          <h2>Kitchen Closed!</h2>
          <p className={styles.scoreDisplay}>Recipes: {recipesCompleted}</p>
          <p className={styles.rewardDisplay}>+{reward} coins</p>
          {recipesCompleted >= 5 && <p className={styles.perfect}>Master Chef!</p>}
          <button className={styles.startBtn} onClick={() => { setReward(0); setGameStarted(false); }}>
            Cook Again
          </button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back to Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.hud}>
        <span className={styles.timer}>⏱ {timeLeft}s</span>
        <span className={styles.score}>Recipes: {recipesCompleted}</span>
      </div>

      {recipe && (
        <div className={`${styles.recipeCard} ${shake ? styles.shake : ''}`}>
          <h3 className={styles.recipeTitle}>Recipe #{recipesCompleted + 1}</h3>
          <div className={styles.recipeRow}>
            {recipe.ingredients.map((ing, i) => (
              <span
                key={i}
                className={`${styles.recipeItem} ${i < currentIndex ? styles.done : ''} ${i === currentIndex ? styles.current : ''}`}
              >
                {ing}
              </span>
            ))}
          </div>
          <div className={styles.progress}>
            {currentIndex}/{recipe.ingredients.length}
          </div>
        </div>
      )}

      <div className={styles.ingredientGrid}>
        {INGREDIENTS.map(ing => (
          <button
            key={ing}
            className={styles.ingredientBtn}
            onClick={() => handleIngredient(ing)}
          >
            {ing}
          </button>
        ))}
      </div>
    </div>
  );
}
