/**
 * Agentic tool-calling loop for blackjack agents.
 *
 * Instead of the app deciding which tools to call, the model receives
 * a list of available tools and decides for itself — exactly like an
 * external browser agent using WebMCP tools.
 *
 * Loop:
 *   1. Send system prompt (with tool descriptions) to Gemma
 *   2. Gemma responds with either:
 *      a) {"tool_call": "get_my_hand"}  → app executes via WebMCP, sends result back
 *      b) {"thinking": "...", "action": "hit"|"stand"}  → loop ends
 *   3. Repeat until action or max turns reached
 */

import type {
  GameState,
  GameAction,
  ThinkingEntry,
  ToolTrace,
} from '../game/types';
import { ROLE_AVAILABLE_TOOLS } from '../game/types';
import {
  callGeminiMultiTurn,
  makeUserMessage,
  makeModelMessage,
  isGeminiAvailable,
} from './gemini-flash';
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
import type { AIPlayerView, DealerView } from '../game/types';

type Dispatch = (action: GameAction) => void;

const MAX_AGENT_TURNS = 5;

/**
 * Valid observation tools the model is allowed to call.
 * Action tools (hit/stand) are NOT executed via callTool — the model
 * expresses them through the {"action": "hit"|"stand"} response.
 */
const OBSERVATION_TOOLS: Record<string, boolean> = {
  get_my_hand: true,
  get_dealer_upcard: true,
  reveal_hidden: true,
};

export async function runAgentTurn(
  role: 'ai_player' | 'dealer',
  state: GameState,
  _dispatch: Dispatch,
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

  const registered = listRegisteredTools();
  console.log(`[WebMCP] ${role} tools:`, registered.map(t => t.name));

  const availableTools = ROLE_AVAILABLE_TOOLS[role];
  const toolTraces: ToolTrace[] = [];

  // ── 2. Try agentic LLM loop, fallback to rules ──
  let reasoning: string;
  let actionType: 'hit' | 'stand';
  let isFallback = false;

  const geminiOk = await isGeminiAvailable();

  if (geminiOk) {
    try {
      const result = await runAgenticLoop(role, langInstruction, toolTraces);
      reasoning = result.thinking;
      actionType = result.action;
    } catch (e) {
      console.warn('Agentic loop failed, falling back to rules:', e);
      isFallback = true;
      const fb = fallback(role, state, thinkingLang, toolTraces);
      reasoning = fb.thinking;
      actionType = fb.action;
    }
  } else {
    isFallback = true;
    const fb = fallback(role, state, thinkingLang, toolTraces);
    reasoning = fb.thinking;
    actionType = fb.action;
  }

  // For dealer, enforce house rules regardless of LLM output
  if (role === 'dealer') {
    const dealerValue = state.dealer.hand.value.best;
    actionType = dealerValue < 17 ? 'hit' : 'stand';
  }

  const langFlag = THINKING_LANG_OPTIONS.find((o) => o.code === thinkingLang)?.flag ?? '';

  const entry: ThinkingEntry = {
    role,
    availableTools,
    toolTraces,
    reasoning,
    action: { type: actionType },
    isFallback,
    langFlag,
  };

  return entry;
}

/**
 * The core agentic loop: model decides which tools to call and when.
 *
 * Conversation flow:
 *   User: system prompt (includes tool descriptions)
 *   Model: {"tool_call": "get_my_hand"}
 *   User: Tool result: {"cards": [...], "value": 18, "soft": false}
 *   Model: {"tool_call": "get_dealer_upcard"}
 *   User: Tool result: {"card": {...}, "value": 6}
 *   Model: {"thinking": "I have 18, dealer shows 6...", "action": "stand"}
 */
async function runAgenticLoop(
  role: 'ai_player' | 'dealer',
  langInstruction: string,
  toolTraces: ToolTrace[],
): Promise<{ thinking: string; action: 'hit' | 'stand' }> {
  const systemPrompt =
    role === 'ai_player'
      ? getAIPlayerPrompt(langInstruction)
      : getDealerPrompt(langInstruction);

  // Start conversation with system prompt
  const messages = [makeUserMessage(systemPrompt)];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const response = await callGeminiMultiTurn(messages);

    if (response.type === 'action') {
      // Model made its final decision
      console.log(`[Agent] ${role} decided: ${response.action} (after ${turn} tool calls)`);
      return { thinking: response.thinking, action: response.action };
    }

    // Model wants to call a tool
    const { toolName } = response;
    console.log(`[Agent] ${role} calls tool: ${toolName} (turn ${turn + 1})`);

    // If model tries to call hit/stand as a tool, treat it as the final action
    if (toolName === 'hit' || toolName === 'stand') {
      console.log(`[Agent] ${role} called action tool "${toolName}" — treating as final decision`);
      return {
        thinking: 'Direct action via tool call.',
        action: toolName,
      };
    }

    // Validate it's a known observation tool
    if (!OBSERVATION_TOOLS[toolName]) {
      console.warn(`[Agent] Unknown tool "${toolName}", asking model to try again`);
      // Add the model's response and an error to conversation
      messages.push(makeModelMessage(JSON.stringify({ tool_call: toolName })));
      messages.push(makeUserMessage(
        `Error: Unknown tool "${toolName}". Available tools: ${Object.keys(OBSERVATION_TOOLS).join(', ')}, hit, stand. Please try again.`,
      ));
      continue;
    }

    // Execute the tool via WebMCP standard API
    let toolResult: unknown;
    try {
      toolResult = await callTool(toolName);
    } catch (err) {
      console.warn(`[Agent] Tool "${toolName}" execution failed:`, err);
      messages.push(makeModelMessage(JSON.stringify({ tool_call: toolName })));
      messages.push(makeUserMessage(`Error executing tool "${toolName}": ${err}. Please make your decision.`));
      continue;
    }

    // Record the trace for ThinkingPanel display
    toolTraces.push({
      toolName,
      result: toolResult,
      timestamp: Date.now(),
    });

    // Add model's tool call + result to conversation history
    messages.push(makeModelMessage(JSON.stringify({ tool_call: toolName })));
    messages.push(makeUserMessage(
      `Tool "${toolName}" result:\n${JSON.stringify(toolResult, null, 2)}\n\nNow decide: call another tool, or respond with {"thinking": "...", "action": "hit" or "stand"}.`,
    ));
  }

  // Max turns reached — force a decision
  console.warn(`[Agent] ${role} hit max turns (${MAX_AGENT_TURNS}), forcing stand`);
  return { thinking: 'Max tool calls reached.', action: 'stand' };
}

/**
 * Fallback to rule-based strategy when Gemma is unavailable.
 * Still calls tools via WebMCP to populate tool traces for display.
 */
function fallback(
  role: 'ai_player' | 'dealer',
  state: GameState,
  thinkingLang: ThinkingLang,
  toolTraces: ToolTrace[],
): { thinking: string; action: 'hit' | 'stand' } {
  // Call tools via WebMCP anyway for consistent trace display
  const callToolSync = async (name: string) => {
    try {
      const result = await callTool(name);
      toolTraces.push({ toolName: name, result, timestamp: Date.now() });
    } catch { /* ignore */ }
  };

  // Fire tool calls (don't await individually — they're fast)
  if (role === 'ai_player') {
    // Synchronously build view from state for rule-based
    const view: AIPlayerView = {
      myHand: {
        cards: state.aiPlayer.hand.cards,
        value: state.aiPlayer.hand.value.best,
        soft: state.aiPlayer.hand.value.isSoft,
      },
      dealerUpcard: {
        card: state.dealer.hand.cards[1],
        value: state.dealer.hand.cards[1]
          ? (() => {
              const r = state.dealer.hand.cards[1].rank;
              if (r === 'A') return 11;
              if (['K', 'Q', 'J'].includes(r)) return 10;
              return parseInt(r);
            })()
          : 0,
      },
      deckInfo: { cardsRemaining: state.deck.length },
      betStatus: { myBet: state.aiPlayer.bet, myChips: state.aiPlayer.chips },
      roundNumber: state.roundNumber,
    };

    // Still call tools for trace display
    callToolSync('get_my_hand');
    callToolSync('get_dealer_upcard');

    return ruleBasedAIPlayer(view, thinkingLang);
  } else {
    const view: DealerView = {
      myHand: {
        cards: state.dealer.hand.cards,
        value: state.dealer.hand.value.best,
      },
      allBets: { player: state.player.bet, aiPlayer: state.aiPlayer.bet },
      deckInfo: { cardsRemaining: state.deck.length },
      roundNumber: state.roundNumber,
    };

    callToolSync('get_my_hand');

    return ruleBasedDealer(view, thinkingLang);
  }
}
