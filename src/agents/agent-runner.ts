import type {
  GameState,
  GameAction,
  ThinkingEntry,
  AIPlayerView,
  DealerView,
  ToolTrace,
} from '../game/types';
import { ROLE_AVAILABLE_TOOLS } from '../game/types';
import { callGeminiFlash, isGeminiAvailable } from './gemini-flash';
import { ruleBasedAIPlayer, ruleBasedDealer } from './rule-based';
import { getAIPlayerPrompt, getDealerPrompt } from './prompts';
import { THINKING_LANG_OPTIONS } from '../i18n/types';
import {
  registerAIPlayerTools,
  registerDealerTools,
  clearAllTools,
  callTool,
  listRegisteredTools,
} from '../webmcp/tools';
import type { ThinkingLang } from '../i18n/types';

type Dispatch = (action: GameAction) => void;

/**
 * Build the AI player's view by calling registered WebMCP tools.
 */
async function buildAIPlayerViewFromTools(): Promise<AIPlayerView & { toolTraces: ToolTrace[] }> {
  const toolTraces: ToolTrace[] = [];

  // Call get_my_hand via WebMCP standard API
  const myHand = await callTool('get_my_hand') as AIPlayerView['myHand'];
  toolTraces.push({
    toolName: 'get_my_hand',
    result: myHand,
    timestamp: Date.now(),
  });

  // Call get_dealer_upcard via WebMCP standard API
  const dealerUpcard = await callTool('get_dealer_upcard') as AIPlayerView['dealerUpcard'];
  toolTraces.push({
    toolName: 'get_dealer_upcard',
    result: dealerUpcard,
    timestamp: Date.now(),
  });

  return {
    myHand,
    dealerUpcard,
    // These fields aren't exposed via tools but are needed for the LLM prompt
    deckInfo: { cardsRemaining: 0 },
    betStatus: { myBet: 0, myChips: 0 },
    roundNumber: 0,
    toolTraces,
  };
}

/**
 * Build the dealer's view by calling registered WebMCP tools.
 */
async function buildDealerViewFromTools(): Promise<DealerView & { toolTraces: ToolTrace[] }> {
  const toolTraces: ToolTrace[] = [];

  // Call get_my_hand via WebMCP standard API — returns full hand including hidden card
  const myHand = await callTool('get_my_hand') as DealerView['myHand'];
  toolTraces.push({
    toolName: 'get_my_hand',
    result: myHand,
    timestamp: Date.now(),
  });

  return {
    myHand,
    allBets: { player: 0, aiPlayer: 0 },
    deckInfo: { cardsRemaining: 0 },
    roundNumber: 0,
    toolTraces,
  };
}

export async function runAgentTurn(
  role: 'ai_player' | 'dealer',
  state: GameState,
  _dispatch: Dispatch, // kept for API compat; action is no longer dispatched here
  langInstruction: string,
  thinkingLang: ThinkingLang,
): Promise<ThinkingEntry> {
  // ── 1. Register role-specific tools via WebMCP standard API ──
  clearAllTools();
  if (role === 'ai_player') {
    registerAIPlayerTools(state);
  } else {
    registerDealerTools(state);
  }

  // Log registered tools (visible in DevTools for debugging)
  const registered = listRegisteredTools();
  console.log(`[WebMCP] ${role} tools:`, registered.map(t => t.name));

  // ── 2. Call tools via navigator.modelContextTesting.executeTool() ──
  let view: AIPlayerView | DealerView;
  let toolTraces: ToolTrace[];

  if (role === 'ai_player') {
    const result = await buildAIPlayerViewFromTools();
    toolTraces = result.toolTraces;
    // Augment with non-tool state data for the LLM prompt
    view = {
      myHand: result.myHand,
      dealerUpcard: result.dealerUpcard,
      deckInfo: { cardsRemaining: state.deck.length },
      betStatus: { myBet: state.aiPlayer.bet, myChips: state.aiPlayer.chips },
      roundNumber: state.roundNumber,
    };
  } else {
    const result = await buildDealerViewFromTools();
    toolTraces = result.toolTraces;
    view = {
      myHand: result.myHand,
      allBets: { player: state.player.bet, aiPlayer: state.aiPlayer.bet },
      deckInfo: { cardsRemaining: state.deck.length },
      roundNumber: state.roundNumber,
    };
  }

  const availableTools = ROLE_AVAILABLE_TOOLS[role];

  // ── 3. Try LLM, fallback to rules ──
  let reasoning: string;
  let actionType: 'hit' | 'stand';
  let isFallback = false;

  const geminiOk = await isGeminiAvailable();

  if (geminiOk) {
    try {
      const prompt =
        role === 'ai_player'
          ? getAIPlayerPrompt(langInstruction)
          : getDealerPrompt(langInstruction);
      const llmResult = await callGeminiFlash(prompt, view);
      reasoning = llmResult.thinking;
      actionType = llmResult.action;
    } catch (e) {
      console.warn('Gemini failed, falling back to rules:', e);
      isFallback = true;
      const fb =
        role === 'ai_player'
          ? ruleBasedAIPlayer(view as AIPlayerView, thinkingLang)
          : ruleBasedDealer(view as DealerView, thinkingLang);
      reasoning = fb.thinking;
      actionType = fb.action;
    }
  } else {
    isFallback = true;
    const fb =
      role === 'ai_player'
        ? ruleBasedAIPlayer(view as AIPlayerView, thinkingLang)
        : ruleBasedDealer(view as DealerView, thinkingLang);
    reasoning = fb.thinking;
    actionType = fb.action;
  }

  // For dealer, enforce house rules regardless of LLM output
  if (role === 'dealer') {
    const dealerValue = state.dealer.hand.value.best;
    actionType = dealerValue < 17 ? 'hit' : 'stand';
  }

  const langFlag = THINKING_LANG_OPTIONS.find((o) => o.code === thinkingLang)?.flag ?? '';

  // Tools stay registered after the turn so WebMCP Inspector can
  // see them. They'll be swapped out when the next turn starts.

  const entry: ThinkingEntry = {
    role,
    availableTools,
    toolTraces,
    reasoning,
    action: { type: actionType },
    isFallback,
    langFlag,
  };

  // NOTE: dispatch is intentionally NOT called here anymore.
  // The caller (App.tsx) is responsible for dispatching after the
  // ThinkingPanel has finished displaying the reasoning.

  return entry;
}
