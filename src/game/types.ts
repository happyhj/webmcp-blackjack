// ─── Card ───

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Deck = Card[];

// ─── Hand ───

export interface HandValue {
  hard: number;
  soft: number;
  best: number;
  isSoft: boolean;
  isBust: boolean;
  isBlackjack: boolean;
}

export interface Hand {
  cards: Card[];
  value: HandValue;
}

// ─── Game Phase ───

export type GamePhase =
  | 'idle'
  | 'betting'
  | 'dealing'
  | 'blackjack_check'
  | 'player_turn'
  | 'ai_turn'
  | 'dealer_turn'
  | 'settling'
  | 'round_end';

// ─── Participant ───

export type Role = 'player' | 'ai_player' | 'dealer';

export interface Participant {
  role: Role;
  hand: Hand;
  chips: number;
  bet: number;
  status: 'active' | 'stand' | 'bust' | 'blackjack';
}

// ─── Thinking ───

export interface ToolTrace {
  toolName: string;
  result: unknown;
  timestamp: number;
}

export interface ThinkingEntry {
  role: Role;
  availableTools: string[];
  toolTraces: ToolTrace[];
  reasoning: string;
  action: AgentAction;
  isFallback: boolean;
  langFlag?: string;
}

// Available tools per role
export const ROLE_AVAILABLE_TOOLS: Record<'ai_player' | 'dealer', string[]> = {
  ai_player: ['get_my_hand', 'get_dealer_upcard', 'hit', 'stand'],
  dealer: ['get_my_hand', 'reveal_hidden', 'hit', 'stand'],
};

// ─── Agent Action ───

export type AgentAction =
  | { type: 'hit' }
  | { type: 'stand' };

// ─── Game State ───

export interface GameState {
  phase: GamePhase;
  currentTurn: Role | null;
  roundNumber: number;
  deck: Deck;

  player: Participant;
  aiPlayer: Participant;
  dealer: Participant;

  dealerHiddenRevealed: boolean;

  thinkingHistory: ThinkingEntry[];
  currentThinking: ThinkingEntry | null;

  log: LogEntry[];
}

export interface LogEntry {
  message: string;
  timestamp: number;
  type: 'info' | 'action' | 'result' | 'error' | 'fallback';
}

// ─── Reducer Actions ───

export type GameAction =
  | { type: 'RESET' }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_BET'; role: Role; amount: number }
  | { type: 'DEAL_INITIAL' }
  | { type: 'HIT'; role: Role }
  | { type: 'STAND'; role: Role }
  | { type: 'REVEAL_DEALER_HIDDEN' }
  | { type: 'SETTLE_ROUND' }
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'SET_TURN'; role: Role | null }
  | { type: 'ADD_THINKING'; entry: ThinkingEntry }
  | { type: 'SET_CURRENT_THINKING'; entry: ThinkingEntry | null }
  | { type: 'ADD_LOG'; entry: Omit<LogEntry, 'timestamp'> };

// ─── LLM Response ───

export interface LLMResponse {
  thinking: string;
  action: 'hit' | 'stand';
}

// ─── Agent View ───

export interface AIPlayerView {
  myHand: { cards: Card[]; value: number; soft: boolean };
  dealerUpcard: { card: Card; value: number };
  deckInfo: { cardsRemaining: number };
  betStatus: { myBet: number; myChips: number };
  roundNumber: number;
}

export interface DealerView {
  myHand: { cards: Card[]; value: number };
  allBets: { player: number; aiPlayer: number };
  deckInfo: { cardsRemaining: number };
  roundNumber: number;
}

// ─── Result ───

export type RoundResult = 'win' | 'lose' | 'push' | 'blackjack_win' | 'blackjack_push';
