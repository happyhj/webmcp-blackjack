import type { GameState, GameAction, Participant, Hand } from './types';
import { createDeck, shuffleDeck, dealCard } from './deck';
import { createHand, addCardToHand } from './hand';
import { determineResult, calculatePayout } from './rules';

function emptyHand(): Hand {
  return createHand([]);
}

function createParticipant(role: 'player' | 'ai_player' | 'dealer', chips: number): Participant {
  return { role, hand: emptyHand(), chips, bet: 0, status: 'active' };
}

export function createInitialState(): GameState {
  return {
    phase: 'idle',
    currentTurn: null,
    roundNumber: 0,
    deck: shuffleDeck(createDeck()),
    player: createParticipant('player', 1000),
    aiPlayer: createParticipant('ai_player', 1000),
    dealer: createParticipant('dealer', Infinity),
    dealerHiddenRevealed: false,
    thinkingHistory: [],
    currentThinking: null,
    log: [],
  };
}

function addLog(state: GameState, message: string, type: GameState['log'][0]['type'] = 'info'): GameState {
  return {
    ...state,
    log: [...state.log, { message, timestamp: Date.now(), type }],
  };
}

function getParticipant(state: GameState, role: string): Participant {
  if (role === 'player') return state.player;
  if (role === 'ai_player') return state.aiPlayer;
  return state.dealer;
}

function setParticipant(state: GameState, role: string, p: Participant): GameState {
  if (role === 'player') return { ...state, player: p };
  if (role === 'ai_player') return { ...state, aiPlayer: p };
  return { ...state, dealer: p };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESET':
      return createInitialState();

    case 'START_ROUND': {
      const roundNumber = state.roundNumber + 1;
      let deck = state.deck.length < 15 ? shuffleDeck(createDeck()) : state.deck;
      return {
        ...state,
        phase: 'betting',
        roundNumber,
        deck,
        player: { ...state.player, hand: emptyHand(), bet: 0, status: 'active' },
        aiPlayer: { ...state.aiPlayer, hand: emptyHand(), bet: 0, status: 'active' },
        dealer: { ...state.dealer, hand: emptyHand(), bet: 0, status: 'active' },
        dealerHiddenRevealed: false,
        thinkingHistory: [],
        currentThinking: null,
        log: [],
      };
    }

    case 'PLACE_BET': {
      const p = getParticipant(state, action.role);
      const updated = { ...p, bet: action.amount, chips: p.chips - action.amount };
      return setParticipant(state, action.role, updated);
    }

    case 'DEAL_INITIAL': {
      let deck = state.deck;
      // Deal 2 cards to each: player, ai_player, dealer
      const deal = () => {
        const r = dealCard(deck);
        deck = r.remainingDeck;
        return r.card;
      };

      const playerCards = [deal(), deal()];
      const aiCards = [deal(), deal()];
      const dealerCards = [deal(), deal()];

      let newState: GameState = {
        ...state,
        deck,
        phase: 'blackjack_check',
        player: { ...state.player, hand: createHand(playerCards) },
        aiPlayer: { ...state.aiPlayer, hand: createHand(aiCards) },
        dealer: { ...state.dealer, hand: createHand(dealerCards) },
      };

      // Check blackjacks
      if (newState.player.hand.value.isBlackjack) {
        newState = { ...newState, player: { ...newState.player, status: 'blackjack' } };
      }
      if (newState.aiPlayer.hand.value.isBlackjack) {
        newState = { ...newState, aiPlayer: { ...newState.aiPlayer, status: 'blackjack' } };
      }
      if (newState.dealer.hand.value.isBlackjack) {
        newState = { ...newState, dealer: { ...newState.dealer, status: 'blackjack' } };
      }

      return newState;
    }

    case 'HIT': {
      const { card, remainingDeck } = dealCard(state.deck);
      const p = getParticipant(state, action.role);
      const newHand = addCardToHand(p.hand, card);
      const newStatus = newHand.value.isBust ? 'bust' as const : p.status;
      const updated = { ...p, hand: newHand, status: newStatus };
      let newState = { ...state, deck: remainingDeck };
      newState = setParticipant(newState, action.role, updated);
      return newState;
    }

    case 'STAND': {
      const p = getParticipant(state, action.role);
      const updated = { ...p, status: 'stand' as const };
      return setParticipant(state, action.role, updated);
    }

    case 'REVEAL_DEALER_HIDDEN': {
      return { ...state, dealerHiddenRevealed: true };
    }

    case 'SETTLE_ROUND': {
      // Determine results for player and AI player
      const playerResult = determineResult(state.player.hand, state.dealer.hand);
      const aiResult = determineResult(state.aiPlayer.hand, state.dealer.hand);

      const playerPayout = calculatePayout(state.player.bet, playerResult);
      const aiPayout = calculatePayout(state.aiPlayer.bet, aiResult);

      return {
        ...state,
        phase: 'round_end',
        player: { ...state.player, chips: state.player.chips + playerPayout },
        aiPlayer: { ...state.aiPlayer, chips: state.aiPlayer.chips + aiPayout },
      };
    }

    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_TURN':
      return { ...state, currentTurn: action.role };

    case 'ADD_THINKING':
      return {
        ...state,
        thinkingHistory: [...state.thinkingHistory, action.entry],
      };

    case 'SET_CURRENT_THINKING':
      return { ...state, currentThinking: action.entry };

    case 'ADD_LOG':
      return addLog(state, action.entry.message, action.entry.type);

    default:
      return state;
  }
}
