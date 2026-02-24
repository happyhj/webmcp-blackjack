import type { Card, Suit } from '../game/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function renderCard(card: Card): string[] {
  const s = SUIT_SYMBOLS[card.suit];
  const r = card.rank === '10' ? '10' : ` ${card.rank}`;
  const rRight = card.rank === '10' ? '10' : `${card.rank} `;

  return [
    '┌─────┐',
    `│${r}   │`,
    `│  ${s}  │`,
    `│   ${rRight}│`,
    '└─────┘',
  ];
}

export function renderHiddenCard(): string[] {
  return [
    '┌─────┐',
    '│░░░░░│',
    '│░░░░░│',
    '│░░░░░│',
    '└─────┘',
  ];
}

export function renderCards(cards: Card[], hiddenIndices: number[] = []): string {
  const rendered = cards.map((card, i) =>
    hiddenIndices.includes(i) ? renderHiddenCard() : renderCard(card)
  );

  if (rendered.length === 0) return '';

  // Merge side by side
  const lines: string[] = [];
  for (let row = 0; row < 5; row++) {
    lines.push(rendered.map((r) => r[row]).join(' '));
  }
  return lines.join('\n');
}

export function cardToString(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}
