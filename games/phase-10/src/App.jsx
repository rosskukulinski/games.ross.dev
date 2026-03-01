import { useState, useCallback, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import { createDeck, shuffleDeck, dealCards, drawFromDeck } from './game/deck';
import { findPhaseCards, PHASES, canHitOnGroup, getGroupType } from './game/phases';
import { decideDraw, decideDiscard, decideLayDown, findHits } from './game/botAI';

const BOT_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);

  const initializeGame = useCallback((numBots) => {
    const deck = shuffleDeck(createDeck());
    const numPlayers = numBots + 1;
    const { hands, remainingDeck } = dealCards(deck, numPlayers);

    // Start discard pile with one card from deck
    const firstDiscard = remainingDeck.pop();

    const players = [
      { name: 'You', hand: hands[0], currentPhase: 1, hasLaidPhase: false, laidPhase: null, score: 0 },
      ...hands.slice(1).map((hand, i) => ({
        name: BOT_NAMES[i],
        hand,
        currentPhase: 1,
        hasLaidPhase: false,
        laidPhase: null,
        score: 0,
      })),
    ];

    setGameState({
      players,
      deck: remainingDeck,
      discardPile: [firstDiscard],
      currentPlayer: 0,
      turnPhase: 'draw', // 'draw' or 'play'
      message: null,
      roundNumber: 1,
      gameOver: false,
      winner: null,
    });
    setSelectedCards([]);
    setGameStarted(true);
  }, []);

  const handleCardSelect = useCallback((card) => {
    setSelectedCards((prev) => {
      const isSelected = prev.some(c => c.id === card.id);
      if (isSelected) {
        return prev.filter(c => c.id !== card.id);
      } else {
        return [...prev, card];
      }
    });
  }, []);

  const handleDrawDeck = useCallback(() => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'draw' || prev.currentPlayer !== 0) return prev;

      const { card, deck: newDeck } = drawFromDeck(prev.deck);
      if (!card) return prev;

      const newPlayers = [...prev.players];
      newPlayers[0] = { ...newPlayers[0], hand: [...newPlayers[0].hand, card] };

      return {
        ...prev,
        players: newPlayers,
        deck: newDeck,
        turnPhase: 'play',
        message: null,
      };
    });
  }, []);

  const handleDrawDiscard = useCallback(() => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'draw' || prev.currentPlayer !== 0) return prev;

      const discardTop = prev.discardPile[prev.discardPile.length - 1];
      if (!discardTop || discardTop.type === 'skip') return prev;

      const newPlayers = [...prev.players];
      newPlayers[0] = { ...newPlayers[0], hand: [...newPlayers[0].hand, discardTop] };

      return {
        ...prev,
        players: newPlayers,
        discardPile: prev.discardPile.slice(0, -1),
        turnPhase: 'play',
        message: null,
      };
    });
  }, []);

  const handleLayDown = useCallback(() => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'play' || prev.currentPlayer !== 0) return prev;

      const player = prev.players[0];
      if (player.hasLaidPhase) return prev;

      // Try to validate the selected cards as the current phase
      const phaseCards = findPhaseCards(selectedCards, player.currentPhase);
      if (!phaseCards) {
        return { ...prev, message: 'Selected cards do not complete your phase!' };
      }

      // Remove the phase cards from hand
      const usedIds = new Set(phaseCards.flat().map(c => c.id));
      const newHand = player.hand.filter(c => !usedIds.has(c.id));

      const newPlayers = [...prev.players];
      newPlayers[0] = {
        ...player,
        hand: newHand,
        hasLaidPhase: true,
        laidPhase: phaseCards,
      };

      setSelectedCards([]);

      return {
        ...prev,
        players: newPlayers,
        message: `Phase ${player.currentPhase} completed!`,
      };
    });
  }, [selectedCards]);

  const handleDiscard = useCallback(() => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'play' || prev.currentPlayer !== 0) return prev;
      if (selectedCards.length !== 1) return prev;

      const discardCard = selectedCards[0];
      const player = prev.players[0];
      const newHand = player.hand.filter(c => c.id !== discardCard.id);

      const newPlayers = [...prev.players];
      newPlayers[0] = { ...player, hand: newHand };

      setSelectedCards([]);

      // Check if player went out
      if (newHand.length === 0) {
        return endRound(prev, newPlayers, 0);
      }

      // Next player's turn
      const nextPlayer = (prev.currentPlayer + 1) % prev.players.length;

      return {
        ...prev,
        players: newPlayers,
        discardPile: [...prev.discardPile, discardCard],
        currentPlayer: nextPlayer,
        turnPhase: 'draw',
        message: null,
      };
    });
  }, [selectedCards]);

  const handleHit = useCallback((card, targetPlayerIndex, groupIndex) => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'play' || prev.currentPlayer !== 0) return prev;

      const player = prev.players[0];
      // Must have laid down your own phase to hit
      if (!player.hasLaidPhase) {
        return { ...prev, message: 'You must lay down your phase before hitting!' };
      }

      const targetPlayer = prev.players[targetPlayerIndex];
      if (!targetPlayer.laidPhase) return prev;

      const group = targetPlayer.laidPhase[groupIndex];
      const groupType = getGroupType(targetPlayer.currentPhase, groupIndex);

      if (!canHitOnGroup(card, group, groupType)) {
        return { ...prev, message: 'That card cannot be added to this group!' };
      }

      // Remove card from player's hand
      const newHand = player.hand.filter(c => c.id !== card.id);

      // Add card to target group
      const newLaidPhase = targetPlayer.laidPhase.map((g, i) =>
        i === groupIndex ? [...g, card] : g
      );

      const newPlayers = [...prev.players];
      newPlayers[0] = { ...player, hand: newHand };
      newPlayers[targetPlayerIndex] = { ...targetPlayer, laidPhase: newLaidPhase };

      setSelectedCards([]);

      // Check if player went out
      if (newHand.length === 0) {
        return endRound(prev, newPlayers, 0);
      }

      return {
        ...prev,
        players: newPlayers,
        message: `Hit on ${targetPlayer.name}'s phase!`,
      };
    });
  }, []);

  // End round and calculate scores
  const endRound = (state, players, winnerIndex) => {
    const newPlayers = players.map((player, i) => {
      // Calculate score from remaining cards
      let roundScore = 0;
      for (const card of player.hand) {
        if (card.type === 'skip') roundScore += 15;
        else if (card.type === 'wild') roundScore += 25;
        else if (card.value >= 10) roundScore += 10;
        else roundScore += 5;
      }

      // Advance phase if player laid down their phase
      const newPhase = player.hasLaidPhase ? player.currentPhase + 1 : player.currentPhase;

      return {
        ...player,
        score: player.score + roundScore,
        currentPhase: newPhase,
        hasLaidPhase: false,
        laidPhase: null,
      };
    });

    // Check for game winner (completed phase 10 and went out)
    const winner = newPlayers.find(p => p.currentPhase > 10);
    if (winner) {
      return {
        ...state,
        players: newPlayers,
        gameOver: true,
        winner: winner.name,
        message: `${winner.name} wins the game!`,
      };
    }

    // Start new round
    const deck = shuffleDeck(createDeck());
    const { hands, remainingDeck } = dealCards(deck, newPlayers.length);
    const firstDiscard = remainingDeck.pop();

    const resetPlayers = newPlayers.map((player, i) => ({
      ...player,
      hand: hands[i],
    }));

    return {
      ...state,
      players: resetPlayers,
      deck: remainingDeck,
      discardPile: [firstDiscard],
      currentPlayer: 0,
      turnPhase: 'draw',
      roundNumber: state.roundNumber + 1,
      message: `Round ${state.roundNumber + 1} - ${players[winnerIndex].name} went out!`,
    };
  };

  // Bot turn logic
  useEffect(() => {
    if (!gameState || gameState.gameOver) return;
    if (gameState.currentPlayer === 0) return;

    const botIndex = gameState.currentPlayer;
    const bot = gameState.players[botIndex];

    const timeout = setTimeout(() => {
      setGameState((prev) => {
        if (prev.currentPlayer !== botIndex) return prev;

        let newState = { ...prev };
        let newPlayers = [...prev.players];
        let newBot = { ...bot };
        let newDeck = [...prev.deck];
        let newDiscardPile = [...prev.discardPile];

        // 1. Draw phase
        const discardTop = newDiscardPile[newDiscardPile.length - 1];
        const drawChoice = decideDraw(newBot.hand, discardTop, newBot.currentPhase);

        if (drawChoice === 'discard' && discardTop && discardTop.type !== 'skip') {
          newBot.hand = [...newBot.hand, discardTop];
          newDiscardPile = newDiscardPile.slice(0, -1);
        } else {
          const { card, deck } = drawFromDeck(newDeck);
          if (card) {
            newBot.hand = [...newBot.hand, card];
            newDeck = deck;
          }
        }

        // 2. Lay down phase if possible
        if (!newBot.hasLaidPhase) {
          const layDown = decideLayDown(newBot.hand, newBot.currentPhase);
          if (layDown) {
            const usedIds = new Set(layDown.flat().map(c => c.id));
            newBot.hand = newBot.hand.filter(c => !usedIds.has(c.id));
            newBot.hasLaidPhase = true;
            newBot.laidPhase = layDown;
          }
        }

        // 3. Hit on laid phases if possible
        if (newBot.hasLaidPhase) {
          const hits = findHits(newBot.hand, newPlayers);
          for (const hit of hits) {
            const targetPlayer = newPlayers[hit.targetPlayerIndex];
            if (!targetPlayer.laidPhase) continue;

            // Remove card from bot's hand
            newBot.hand = newBot.hand.filter(c => c.id !== hit.card.id);

            // Add card to target group
            const newLaidPhase = targetPlayer.laidPhase.map((g, i) =>
              i === hit.groupIndex ? [...g, hit.card] : g
            );
            newPlayers[hit.targetPlayerIndex] = { ...targetPlayer, laidPhase: newLaidPhase };

            if (newBot.hand.length === 0) break;
          }
        }

        newPlayers[botIndex] = newBot;

        // Check if bot went out after hitting
        if (newBot.hand.length === 0) {
          return endRound(
            { ...newState, deck: newDeck, discardPile: newDiscardPile },
            newPlayers,
            botIndex
          );
        }

        // 4. Discard
        const discardCard = decideDiscard(newBot.hand, newBot.currentPhase, newBot.hasLaidPhase);
        newBot.hand = newBot.hand.filter(c => c.id !== discardCard.id);
        newDiscardPile = [...newDiscardPile, discardCard];

        newPlayers[botIndex] = newBot;

        // Check if bot went out after discarding
        if (newBot.hand.length === 0) {
          return endRound(
            { ...newState, deck: newDeck, discardPile: newDiscardPile },
            newPlayers,
            botIndex
          );
        }

        // Handle skip card
        let nextPlayer = (botIndex + 1) % prev.players.length;
        if (discardCard.type === 'skip') {
          nextPlayer = (nextPlayer + 1) % prev.players.length;
        }

        return {
          ...newState,
          players: newPlayers,
          deck: newDeck,
          discardPile: newDiscardPile,
          currentPlayer: nextPlayer,
          turnPhase: 'draw',
          message: newBot.hasLaidPhase && newBot.laidPhase ? `${newBot.name} laid down Phase ${newBot.currentPhase}!` : null,
        };
      });
    }, 1000); // 1 second delay for bot turns

    return () => clearTimeout(timeout);
  }, [gameState?.currentPlayer, gameState?.gameOver]);

  // Reshuffle discard pile if deck runs out
  useEffect(() => {
    if (!gameState || gameState.deck.length > 0) return;
    if (gameState.discardPile.length <= 1) return;

    setGameState((prev) => {
      const topDiscard = prev.discardPile[prev.discardPile.length - 1];
      const cardsToShuffle = prev.discardPile.slice(0, -1);
      const newDeck = shuffleDeck(cardsToShuffle);

      return {
        ...prev,
        deck: newDeck,
        discardPile: [topDiscard],
        message: 'Deck reshuffled from discard pile',
      };
    });
  }, [gameState?.deck.length]);

  if (!gameStarted) {
    return <SetupScreen onStartGame={initializeGame} />;
  }

  if (gameState.gameOver) {
    return (
      <div className="game-over">
        <h1>Game Over!</h1>
        <h2>{gameState.winner} wins!</h2>
        <div className="final-scores">
          <h3>Final Scores</h3>
          {gameState.players
            .sort((a, b) => a.score - b.score)
            .map((player, i) => (
              <div key={i} className="score-row">
                <span>{player.name}</span>
                <span>Phase {Math.min(player.currentPhase, 10)}</span>
                <span>{player.score} pts</span>
              </div>
            ))}
        </div>
        <button onClick={() => setGameStarted(false)}>Play Again</button>
      </div>
    );
  }

  return (
    <GameBoard
      gameState={gameState}
      selectedCards={selectedCards}
      onCardSelect={handleCardSelect}
      onDrawDeck={handleDrawDeck}
      onDrawDiscard={handleDrawDiscard}
      onLayDown={handleLayDown}
      onDiscard={handleDiscard}
      onHit={handleHit}
    />
  );
}

export default App;
