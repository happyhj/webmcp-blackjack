import type { Card, Hand, HandValue } from './types';

export function cardValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

export function calculateHandValue(cards: Card[]): HandValue {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount++;
      total += 11;
    } else {
      total += cardValue(card);
    }
  }

  // Convert aces from 11 to 1 as needed
  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  const hard = cards.reduce((sum, c) => sum + (c.rank === 'A' ? 1 : cardValue(c)), 0);
  const soft = total;
  const isSoft = aceCount > 0 && soft <= 21;

  return {
    hard,
    soft,
    best: soft <= 21 ? soft : hard,
    isSoft,
    isBust: soft > 21 && hard > 21,
    isBlackjack: cards.length === 2 && soft === 21,
  };
}

export function createHand(cards: Card[]): Hand {
  return {
    cards,
    value: calculateHandValue(cards),
  };
}

export function addCardToHand(hand: Hand, card: Card): Hand {
  const newCards = [...hand.cards, card];
  return createHand(newCards);
}
