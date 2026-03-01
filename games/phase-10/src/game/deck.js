// Card colors
export const COLORS = ['red', 'blue', 'green', 'yellow'];

// Create the full Phase 10 deck (108 cards)
export function createDeck() {
  const deck = [];
  let id = 0;

  // Number cards: 1-12 in each color, 2 of each
  for (const color of COLORS) {
    for (let value = 1; value <= 12; value++) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({
          id: id++,
          type: 'number',
          value,
          color,
        });
      }
    }
  }

  // Wild cards (8 total)
  for (let i = 0; i < 8; i++) {
    deck.push({
      id: id++,
      type: 'wild',
      value: null,
      color: null,
    });
  }

  // Skip cards (4 total)
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: id++,
      type: 'skip',
      value: null,
      color: null,
    });
  }

  return deck;
}

// Fisher-Yates shuffle
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deal cards to players
export function dealCards(deck, numPlayers, cardsPerPlayer = 10) {
  const hands = Array.from({ length: numPlayers }, () => []);
  const remainingDeck = [...deck];

  for (let card = 0; card < cardsPerPlayer; card++) {
    for (let player = 0; player < numPlayers; player++) {
      if (remainingDeck.length > 0) {
        hands[player].push(remainingDeck.pop());
      }
    }
  }

  return { hands, remainingDeck };
}

// Draw a card from the deck
export function drawFromDeck(deck) {
  if (deck.length === 0) return { card: null, deck: [] };
  const newDeck = [...deck];
  const card = newDeck.pop();
  return { card, deck: newDeck };
}

// Get display text for a card
export function getCardDisplay(card) {
  if (card.type === 'wild') return 'W';
  if (card.type === 'skip') return 'S';
  return card.value.toString();
}
