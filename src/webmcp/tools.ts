/**
 * WebMCP tool registration for blackjack agents and human player.
 *
 * Uses the W3C navigator.modelContext API (via polyfill) to register
 * role-scoped tools. The same tool name (e.g. "get_my_hand") returns
 * different data depending on which role's tools are currently registered.
 *
 * Tool sets swap at each phase transition so the WebMCP Inspector
 * always reflects who can do what right now.
 */

import type { GameState } from '../game/types';
import { cardValue } from '../game/hand';

// ─── Callback-based action tools ───

/**
 * Player action callbacks passed from App.tsx so that
 * Inspector-triggered tool calls actually move the game forward.
 */
export interface PlayerCallbacks {
  onHit: () => void;
  onStand: () => void;
}

export interface BetCallbacks {
  onBet: (amount: number) => void;
}

function makeHitTool(cb?: () => void) {
  return {
    name: 'hit',
    description: 'Request another card. Increases hand value but risks busting over 21.',
    inputSchema: { type: 'object', properties: {} } as const,
    execute: async () => {
      cb?.();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ action: 'hit', accepted: true }) }],
      };
    },
  };
}

function makeStandTool(cb?: () => void) {
  return {
    name: 'stand',
    description: 'Keep current hand and end turn. No more cards will be dealt.',
    inputSchema: { type: 'object', properties: {} } as const,
    execute: async () => {
      cb?.();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ action: 'stand', accepted: true }) }],
      };
    },
  };
}

// ─── Player tools (human) ───

/**
 * Register tools for the betting phase.
 * Only tool: place_bet with an amount parameter.
 */
export function registerPlayerBettingTools(
  state: GameState,
  callbacks: BetCallbacks,
): void {
  const mc = navigator.modelContext;

  mc.registerTool({
    name: 'place_bet',
    description: 'Place a bet to start the round. Valid amounts: 25, 50, 100, 200.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Bet amount. Must be one of: 25, 50, 100, 200.',
        },
      },
      required: ['amount'],
    },
    execute: async (args: Record<string, unknown>) => {
      const amount = Number(args.amount) || 50;
      const valid = [25, 50, 100, 200];
      const bet = valid.includes(amount) ? amount : 50;
      callbacks.onBet(bet);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            action: 'place_bet',
            amount: bet,
            chips_remaining: state.player.chips - bet,
          }),
        }],
      };
    },
  });
}

/**
 * Register tools for the player's turn.
 * Same observation tools as Alex + action tools that dispatch real game moves.
 */
export function registerPlayerTurnTools(
  state: GameState,
  callbacks: PlayerCallbacks,
): void {
  const mc = navigator.modelContext;

  mc.registerTool({
    name: 'get_my_hand',
    description: 'Returns your current hand, value, and whether it is soft.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          cards: state.player.hand.cards,
          value: state.player.hand.value.best,
          soft: state.player.hand.value.isSoft,
        }),
      }],
    }),
  });

  mc.registerTool({
    name: 'get_dealer_upcard',
    description: 'Returns the dealer\'s visible (face-up) card and its value.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const upcard = state.dealer.hand.cards[1];
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            card: upcard,
            value: cardValue(upcard),
          }),
        }],
      };
    },
  });

  mc.registerTool(makeHitTool(callbacks.onHit));
  mc.registerTool(makeStandTool(callbacks.onStand));
}

// ─── AI Player tools ───

/**
 * Register AI Player tools.
 * Observation: get_my_hand, get_dealer_upcard
 * Action: hit, stand
 */
export function registerAIPlayerTools(state: GameState): void {
  const mc = navigator.modelContext;

  mc.registerTool({
    name: 'get_my_hand',
    description: 'Returns the AI player\'s current hand, value, and whether it is soft.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          cards: state.aiPlayer.hand.cards,
          value: state.aiPlayer.hand.value.best,
          soft: state.aiPlayer.hand.value.isSoft,
        }),
      }],
    }),
  });

  mc.registerTool({
    name: 'get_dealer_upcard',
    description: 'Returns the dealer\'s visible (face-up) card and its value.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const upcard = state.dealer.hand.cards[1];
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            card: upcard,
            value: cardValue(upcard),
          }),
        }],
      };
    },
  });

  mc.registerTool(makeHitTool());
  mc.registerTool(makeStandTool());
}

// ─── Dealer tools ───

/**
 * Register Dealer tools.
 * Observation: get_my_hand (full hand including hidden card)
 * Action: reveal_hidden, hit, stand
 */
export function registerDealerTools(state: GameState): void {
  const mc = navigator.modelContext;

  mc.registerTool({
    name: 'get_my_hand',
    description: 'Returns the dealer\'s full hand including the hidden card.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          cards: state.dealer.hand.cards,
          value: state.dealer.hand.value.best,
        }),
      }],
    }),
  });

  mc.registerTool({
    name: 'reveal_hidden',
    description: 'Reveals the dealer\'s face-down card to all players.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          revealed: true,
          card: state.dealer.hand.cards[0],
        }),
      }],
    }),
  });

  mc.registerTool(makeHitTool());
  mc.registerTool(makeStandTool());
}

/**
 * Unregister all tools and clear context.
 */
export function clearAllTools(): void {
  navigator.modelContext.clearContext();
}

// ─── Tool execution via testing API ───

/**
 * Call a registered tool by name via navigator.modelContextTesting.
 * Returns the parsed JSON result.
 */
export async function callTool(name: string, args: string = '{}'): Promise<unknown> {
  const testing = navigator.modelContextTesting!;
  const result = await testing.executeTool(name, args);
  if (result === null) {
    throw new Error(`Tool "${name}" returned null`);
  }
  const parsed = JSON.parse(result);
  if (parsed?.content?.[0]?.text) {
    return JSON.parse(parsed.content[0].text);
  }
  return parsed;
}

/**
 * List all currently registered tools.
 */
export function listRegisteredTools(): { name: string; description: string }[] {
  return navigator.modelContextTesting!.listTools();
}
