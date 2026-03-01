import { findPhaseCards, canHitOnGroup, getGroupType } from './phases.js';

// Decide whether to draw from deck or discard pile
export function decideDraw(hand, discardTop, phaseNumber) {
  if (!discardTop || discardTop.type === 'skip') {
    return 'deck';
  }

  // Check if the discard card helps with the current phase
  const handWithDiscard = [...hand, discardTop];
  const canCompleteWithDiscard = findPhaseCards(handWithDiscard, phaseNumber);
  const canCompleteWithoutDiscard = findPhaseCards(hand, phaseNumber);

  if (canCompleteWithDiscard && !canCompleteWithoutDiscard) {
    return 'discard';
  }

  // Check if the card matches something in hand (for sets)
  const matchingCards = hand.filter(c =>
    c.type === 'number' && discardTop.type === 'number' && c.value === discardTop.value
  );

  if (matchingCards.length >= 2) {
    return 'discard';
  }

  // Wild cards are always valuable
  if (discardTop.type === 'wild') {
    return 'discard';
  }

  // Default to deck
  return 'deck';
}

// Decide which card to discard
export function decideDiscard(hand, phaseNumber, hasLaidPhase) {
  // Never discard wilds unless we have to
  const nonWilds = hand.filter(c => c.type !== 'wild');
  const candidates = nonWilds.length > 0 ? nonWilds : hand;

  // If we haven't laid our phase, keep cards that help
  if (!hasLaidPhase) {
    const phaseCards = findPhaseCards(hand, phaseNumber);
    if (phaseCards) {
      const phaseCardIds = new Set(phaseCards.flat().map(c => c.id));
      const nonPhaseCards = candidates.filter(c => !phaseCardIds.has(c.id));
      if (nonPhaseCards.length > 0) {
        // Discard skip cards first, then highest value
        const skips = nonPhaseCards.filter(c => c.type === 'skip');
        if (skips.length > 0) return skips[0];
        return nonPhaseCards.reduce((highest, c) =>
          (c.value || 0) > (highest.value || 0) ? c : highest
        );
      }
    }
  }

  // Prioritize discarding skip cards
  const skips = candidates.filter(c => c.type === 'skip');
  if (skips.length > 0) return skips[0];

  // Discard cards that don't match anything
  const valueCounts = {};
  hand.forEach(c => {
    if (c.type === 'number') {
      valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
    }
  });

  // Find singletons (cards with no matches)
  const singletons = candidates.filter(c =>
    c.type === 'number' && valueCounts[c.value] === 1
  );

  if (singletons.length > 0) {
    // Discard highest singleton
    return singletons.reduce((highest, c) => c.value > highest.value ? c : highest);
  }

  // Discard highest card
  const numberCards = candidates.filter(c => c.type === 'number');
  if (numberCards.length > 0) {
    return numberCards.reduce((highest, c) => c.value > highest.value ? c : highest);
  }

  return candidates[0];
}

// Decide whether to lay down phase
export function decideLayDown(hand, phaseNumber) {
  const phaseCards = findPhaseCards(hand, phaseNumber);
  return phaseCards; // Returns the groups or null
}

// Find all possible hits for cards in hand on any laid phases
export function findHits(hand, players) {
  const hits = [];

  for (const card of hand) {
    if (card.type === 'skip') continue;

    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
      const player = players[playerIndex];
      if (!player.laidPhase) continue;

      for (let groupIndex = 0; groupIndex < player.laidPhase.length; groupIndex++) {
        const group = player.laidPhase[groupIndex];
        const groupType = getGroupType(player.currentPhase, groupIndex);

        if (canHitOnGroup(card, group, groupType)) {
          hits.push({
            card,
            targetPlayerIndex: playerIndex,
            groupIndex,
          });
          break; // Only hit once per card
        }
      }
    }
  }

  return hits;
}

// Execute a full bot turn
export function executeBotTurn(gameState, botIndex) {
  const bot = gameState.players[botIndex];
  const actions = [];

  // 1. Draw
  const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
  const drawChoice = decideDraw(bot.hand, discardTop, bot.currentPhase);
  actions.push({ type: 'draw', source: drawChoice });

  // Simulate drawing
  let newHand = [...bot.hand];
  if (drawChoice === 'discard' && discardTop) {
    newHand.push(discardTop);
  } else {
    // We'll draw from deck in the actual game
    newHand.push({ id: -1, type: 'number', value: 1, color: 'red' }); // Placeholder
  }

  // 2. Check if we can lay down phase
  if (!bot.hasLaidPhase) {
    const layDown = decideLayDown(newHand, bot.currentPhase);
    if (layDown) {
      actions.push({ type: 'layDown', groups: layDown });
      // Remove laid cards from hand
      const laidIds = new Set(layDown.flat().map(c => c.id));
      newHand = newHand.filter(c => !laidIds.has(c.id));
    }
  }

  // 3. Decide discard
  const discardCard = decideDiscard(newHand, bot.currentPhase, bot.hasLaidPhase);
  actions.push({ type: 'discard', card: discardCard });

  return actions;
}
