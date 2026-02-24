import type { Hand, RoundResult } from './types';

// Dealer must hit on 16 or below, stand on 17+ (soft 17 also stands)
export function mustDealerHit(hand: Hand): boolean {
  return hand.value.best < 17;
}

// Determine round result
export function determineResult(playerHand: Hand, dealerHand: Hand): RoundResult {
  const pv = playerHand.value;
  const dv = dealerHand.value;

  // Player bust
  if (pv.isBust) return 'lose';

  // Player blackjack
  if (pv.isBlackjack) {
    if (dv.isBlackjack) return 'blackjack_push';
    return 'blackjack_win';
  }

  // Dealer bust
  if (dv.isBust) return 'win';

  // Dealer blackjack (player doesn't have blackjack)
  if (dv.isBlackjack) return 'lose';

  // Compare values
  if (pv.best > dv.best) return 'win';
  if (pv.best < dv.best) return 'lose';
  return 'push';
}

// Calculate payout
export function calculatePayout(bet: number, result: RoundResult): number {
  switch (result) {
    case 'blackjack_win': return Math.floor(bet * 2.5); // 3:2
    case 'win': return bet * 2;
    case 'push':
    case 'blackjack_push': return bet; // refund
    case 'lose': return 0;
  }
}
