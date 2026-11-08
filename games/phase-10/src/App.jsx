import { useState, useCallback, useEffect, useRef } from 'react';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import { createDeck, shuffleDeck, dealCards, drawFromDeck } from './game/deck';
import { findPhaseCards, PHASES, canHitOnGroup, getGroupType } from './game/phases';
import { decideDraw, decideDiscard, decideLayDown, findHits } from './game/botAI';
import { describeMissing, sortHand } from './game/helper';

// Bot turns are quick so a kid is not left waiting; 3 bots ≈ 2s.
const BOT_DELAY_MS = 650;
// A second tap on the same card this soon after the first is an accidental
// double-tap, not a deliberate "put it back".
const DOUBLE_TAP_MS = 350;

const BOT_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [nudge, setNudge] = useState(0);
  const lastToggle = useRef({ id: null, t: 0 });
  const settings = useRef({ numBots: 2, easy: true });
  const stateRef = useRef(null);
  stateRef.current = { gameState, selectedCards };

  const initializeGame = useCallback((numBots, easy = true) => {
    settings.current = { numBots, easy };
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
      easy,
      gameOver: false,
      winner: null,
    });
    setSelectedCards([]);
    setGameStarted(true);
  }, []);

  const handleCardSelect = useCallback((card) => {
    const now = performance.now();
    if (lastToggle.current.id === card.id && now - lastToggle.current.t < DOUBLE_TAP_MS) return;
    lastToggle.current = { id: card.id, t: now };
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

  const handleLayDown = useCallback((groups) => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'play' || prev.currentPlayer !== 0) return prev;

      const player = prev.players[0];
      if (player.hasLaidPhase) return prev;

      // Explicit groups (from Help me), else the selected cards; in Easy mode
      // fall back to any phase the hand can make, so the button never fails.
      let phaseCards = Array.isArray(groups)
        ? groups
        : findPhaseCards(selectedCards, player.currentPhase);
      if (!phaseCards && prev.easy) phaseCards = findPhaseCards(player.hand, player.currentPhase);
      if (!phaseCards) {
        return { ...prev, message: describeMissing(selectedCards, player.currentPhase) };
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
        message: `Phase ${player.currentPhase} done! Now throw away cards.`,
        celebrate: { text: `Phase ${player.currentPhase} done!`, id: Date.now() },
      };
    });
  }, [selectedCards]);

  const handleDiscard = useCallback((cardArg) => {
    setGameState((prev) => {
      if (prev.turnPhase !== 'play' || prev.currentPlayer !== 0) return prev;
      const explicit = cardArg && cardArg.id !== undefined && cardArg.type ? cardArg : null;
      if (!explicit && selectedCards.length !== 1) return prev;

      const discardCard = explicit || selectedCards[0];
      const player = prev.players[0];
      const newHand = player.hand.filter(c => c.id !== discardCard.id);

      const newPlayers = [...prev.players];
      newPlayers[0] = { ...player, hand: newHand };

      setSelectedCards([]);

      // Check if player went out
      if (newHand.length === 0) {
        return endRound(prev, newPlayers, 0);
      }

      // Next player's turn (a Skip jumps over the next player)
      let nextPlayer = (prev.currentPlayer + 1) % prev.players.length;
      if (discardCard.type === 'skip') nextPlayer = (nextPlayer + 1) % prev.players.length;

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
        message: targetPlayerIndex === 0 ? 'Added to your phase!' : `Added to ${targetPlayer.name}'s phase!`,
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
      celebrate: winnerIndex === 0 ? { text: 'You went out!', id: Date.now() } : state.celebrate,
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
    }, BOT_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [gameState?.currentPlayer, gameState?.gameOver]);

  // Tapping hand cards before drawing: pulse the piles and say why.
  const handleEarlyCardTap = useCallback(() => {
    setNudge(Date.now());
    setGameState((prev) => ({ ...prev, message: 'Take a card first! Tap the deck.' }));
  }, []);

  // "Help me": do the next sensible step of the turn for the player.
  const handleHelp = useCallback(() => {
    const { gameState: gs } = stateRef.current;
    if (!gs || gs.currentPlayer !== 0 || gs.gameOver) return;
    const me = gs.players[0];
    setSelectedCards([]);
    if (gs.turnPhase === 'draw') {
      const top = gs.discardPile[gs.discardPile.length - 1];
      if (decideDraw(me.hand, top, me.currentPhase) === 'discard' && top && top.type !== 'skip') handleDrawDiscard();
      else handleDrawDeck();
      return;
    }
    if (!me.hasLaidPhase) {
      const groups = findPhaseCards(me.hand, me.currentPhase);
      if (groups) { handleLayDown(groups); return; }
    } else {
      const hit = findHits(me.hand, gs.players)[0];
      if (hit) { handleHit(hit.card, hit.targetPlayerIndex, hit.groupIndex); return; }
    }
    handleDiscard(decideDiscard(me.hand, me.currentPhase, me.hasLaidPhase));
  }, [handleDrawDeck, handleDrawDiscard, handleLayDown, handleHit, handleDiscard]);

  // Read-only state for play-test validators.
  useEffect(() => {
    Object.defineProperty(window, '__game', {
      configurable: true,
      get() {
        const { gameState: gs, selectedCards: sel } = stateRef.current;
        if (!gs) return { screen: 'setup' };
        const me = gs.players[0];
        const myTurn = gs.currentPlayer === 0;
        return {
          screen: gs.gameOver ? 'gameover' : 'game',
          mode: gs.easy ? 'easy' : 'classic',
          phase: me.currentPhase,
          round: gs.roundNumber,
          turnStage: gs.gameOver ? 'over' : myTurn ? gs.turnPhase : 'bot',
          currentPlayer: gs.currentPlayer,
          hand: sortHand(me.hand).map(({ id, type, value, color }) => ({ id, type, value, color })),
          selected: sel.map((c) => c.id),
          laid: me.hasLaidPhase,
          canLayDown: myTurn && gs.turnPhase === 'play' && !me.hasLaidPhase && !!findPhaseCards(me.hand, me.currentPhase),
          message: gs.message,
          scores: gs.players.map((p) => ({ name: p.name, phase: p.currentPhase, score: p.score, cards: p.hand.length, laid: p.hasLaidPhase })),
          winner: gs.winner,
        };
      },
    });
  }, []);

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
    return <SetupScreen onStartGame={initializeGame} initial={settings.current} />;
  }

  if (gameState.gameOver) {
    return (
      <div className="game-over">
        <h1>Game Over!</h1>
        <h2>{gameState.winner} wins!</h2>
        <div className="final-scores">
          <h3>Final Scores</h3>
          {[...gameState.players]
            .sort((a, b) => a.score - b.score)
            .map((player, i) => (
              <div key={i} className="score-row">
                <span>{player.name}</span>
                <span>Phase {Math.min(player.currentPhase, 10)}</span>
                <span>{player.score} pts</span>
              </div>
            ))}
        </div>
        <div className="game-over-buttons">
          <button
            className="play-again"
            onClick={() => initializeGame(settings.current.numBots, settings.current.easy)}
          >
            ▶ Play Again
          </button>
          <button className="menu-btn" onClick={() => setGameStarted(false)}>Menu</button>
        </div>
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
      onHelp={handleHelp}
      onEarlyCardTap={handleEarlyCardTap}
      onClearSelection={() => setSelectedCards([])}
      nudge={nudge}
    />
  );
}

export default App;
