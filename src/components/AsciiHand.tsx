import type { Hand } from '../game/types';
import { renderCards } from '../ascii/card-renderer';

const EMPTY_SLOTS = [
  '┌─────┐ ┌─────┐',
  '│ · · │ │ · · │',
  '│  ·  │ │  ·  │',
  '│ · · │ │ · · │',
  '└─────┘ └─────┘',
].join('\n');

interface AsciiHandProps {
  hand: Hand;
  hiddenIndices?: number[];
  label: string;
  showEmpty?: boolean;
}

export function AsciiHand({ hand, hiddenIndices = [], label, showEmpty = false }: AsciiHandProps) {
  const hasCards = hand.cards.length > 0;
  const hasHidden = hiddenIndices.length > 0;
  const displayValue = !hasCards ? '' : hasHidden ? '?' : String(hand.value.best);

  return (
    <div>
      <div className="section-label">
        {label}{displayValue ? ` (${displayValue})` : ''}
        {hasCards && !hasHidden && hand.value.isBust && (
          <span className="bust-flash"> BUST!</span>
        )}
        {hasCards && !hasHidden && hand.value.isBlackjack && (
          <span style={{ color: 'var(--green)' }}> BLACKJACK!</span>
        )}
      </div>
      <div className="ascii-cards">
        {hasCards ? renderCards(hand.cards, hiddenIndices) : showEmpty ? EMPTY_SLOTS : null}
      </div>
    </div>
  );
}
