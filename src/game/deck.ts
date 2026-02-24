import type { Card, Deck, Suit, Rank } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): Deck {
  const deck: Deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates shuffle
export function shuffleDeck(deck: Deck): Deck {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCard(deck: Deck): { card: Card; remainingDeck: Deck } {
  if (deck.length === 0) {
    // Reshuffle
    const newDeck = shuffleDeck(createDeck());
    const [card, ...remainingDeck] = newDeck;
    return { card, remainingDeck };
  }
  const [card, ...remainingDeck] = deck;
  return { card, remainingDeck };
}
