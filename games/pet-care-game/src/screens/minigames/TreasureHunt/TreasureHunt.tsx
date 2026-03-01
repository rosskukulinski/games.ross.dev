import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useCountdown } from '../../../hooks/useCountdown';
import { generateCards, calculateReward, GAME_TIME, TOTAL_PAIRS } from './treasureHuntLogic';
import type { Card } from './treasureHuntLogic';
import styles from './TreasureHunt.module.css';

export function TreasureHunt() {
  const navigate = useGameStore(s => s.navigate);
  const addCurrency = useGameStore(s => s.addCurrency);
  const { timeLeft, isRunning, isFinished, start } = useCountdown(GAME_TIME);

  const [cards, setCards] = useState<Card[]>([]);
  const [_flippedIds, setFlippedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [pairsFound, setPairsFound] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [reward, setReward] = useState(0);
  const lockRef = useRef(false);

  const startGame = useCallback(() => {
    setCards(generateCards());
    setFlippedIds([]);
    setMoves(0);
    setPairsFound(0);
    setReward(0);
    setGameStarted(true);
    lockRef.current = false;
    start();
  }, [start]);

  const handleFlip = useCallback((id: string) => {
    if (!isRunning || lockRef.current) return;

    setCards(prev => {
      const card = prev.find(c => c.id === id);
      if (!card || card.flipped || card.matched) return prev;

      const newCards = prev.map(c => c.id === id ? { ...c, flipped: true } : c);
      const currentFlipped = newCards.filter(c => c.flipped && !c.matched);

      if (currentFlipped.length === 2) {
        lockRef.current = true;
        setMoves(m => m + 1);

        if (currentFlipped[0].symbol === currentFlipped[1].symbol) {
          // Match!
          setTimeout(() => {
            setCards(p => p.map(c =>
              c.symbol === currentFlipped[0].symbol ? { ...c, matched: true, flipped: false } : c
            ));
            setPairsFound(p => p + 1);
            lockRef.current = false;
          }, 500);
        } else {
          // No match — flip back
          setTimeout(() => {
            setCards(p => p.map(c =>
              !c.matched ? { ...c, flipped: false } : c
            ));
            lockRef.current = false;
          }, 1000);
        }
      }

      return newCards;
    });

    setFlippedIds(prev => [...prev, id]);
  }, [isRunning]);

  const allFound = pairsFound >= TOTAL_PAIRS;

  if ((isFinished || allFound) && gameStarted && reward === 0) {
    const r = calculateReward(pairsFound, moves);
    setReward(r);
    addCurrency(r);
  }

  if (!gameStarted) {
    return (
      <div className={styles.screen}>
        <div className={styles.intro}>
          <h2>Treasure Hunt</h2>
          <p>Match pairs of treasure cards!</p>
          <p className={styles.tip}>Find all {TOTAL_PAIRS} pairs before time runs out.</p>
          <button className={styles.startBtn} onClick={startGame}>Hunt!</button>
          <button className={styles.backLink} onClick={() => navigate('minigame-hub')}>Back</button>
        </div>
      </div>
    );
  }

  if (isFinished || allFound) {
    return (
      <div className={styles.screen}>
        <div className={styles.results}>
          <h2>{allFound ? 'All Found!' : "Time's Up!"}</h2>
          <p className={styles.scoreDisplay}>Pairs: {pairsFound}/{TOTAL_PAIRS}</p>
          <p className={styles.movesDisplay}>Moves: {moves}</p>
          <p className={styles.rewardDisplay}>+{reward} coins</p>
          {allFound && <p className={styles.perfect}>Perfect memory!</p>}
          <button className={styles.startBtn} onClick={() => { setReward(0); setGameStarted(false); }}>
            Play Again
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
        <span className={styles.score}>Pairs: {pairsFound}/{TOTAL_PAIRS}</span>
      </div>
      <div className={styles.grid}>
        {cards.map(card => (
          <button
            key={card.id}
            className={`${styles.card} ${card.flipped ? styles.flipped : ''} ${card.matched ? styles.matched : ''}`}
            onClick={() => handleFlip(card.id)}
            disabled={card.matched}
          >
            {(card.flipped || card.matched) ? (
              <span className={styles.symbol}>{card.symbol}</span>
            ) : (
              <span className={styles.cardBack}>?</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
