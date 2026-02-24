import type {
  GameState,
  GameAction,
  ThinkingEntry,
  AIPlayerView,
  DealerView,
  ToolTrace,
} from '../game/types';
import { ROLE_AVAILABLE_TOOLS } from '../game/types';
import { cardValue } from '../game/hand';
import { callGeminiFlash, isGeminiAvailable } from './gemini-flash';
import { ruleBasedAIPlayer, ruleBasedDealer } from './rule-based';
import { getAIPlayerPrompt, getDealerPrompt } from './prompts';
import { THINKING_LANG_OPTIONS } from '../i18n/types';
import type { ThinkingLang } from '../i18n/types';

type Dispatch = (action: GameAction) => void;

function buildAIPlayerView(state: GameState): AIPlayerView {
  const upcard = state.dealer.hand.cards[1]; // face-up card (index 1)
  const upcardVal = cardValue(upcard);

  return {
    myHand: {
      cards: state.aiPlayer.hand.cards,
      value: state.aiPlayer.hand.value.best,
      soft: state.aiPlayer.hand.value.isSoft,
    },
    dealerUpcard: { card: upcard, value: upcardVal },
    deckInfo: { cardsRemaining: state.deck.length },
    betStatus: { myBet: state.aiPlayer.bet, myChips: state.aiPlayer.chips },
    roundNumber: state.roundNumber,
  };
}

function buildDealerView(state: GameState): DealerView {
  return {
    myHand: {
      cards: state.dealer.hand.cards,
      value: state.dealer.hand.value.best,
    },
    allBets: {
      player: state.player.bet,
      aiPlayer: state.aiPlayer.bet,
    },
    deckInfo: { cardsRemaining: state.deck.length },
    roundNumber: state.roundNumber,
  };
}

export async function runAgentTurn(
  role: 'ai_player' | 'dealer',
  state: GameState,
  _dispatch: Dispatch, // kept for API compat; action is no longer dispatched here
  langInstruction: string,
  thinkingLang: ThinkingLang,
): Promise<ThinkingEntry> {
  const view =
    role === 'ai_player' ? buildAIPlayerView(state) : buildDealerView(state);

  const availableTools = ROLE_AVAILABLE_TOOLS[role];

  // Build tool traces (simulated — tools return the view data)
  const toolTraces: ToolTrace[] = [];
  if (role === 'ai_player') {
    const pv = view as AIPlayerView;
    toolTraces.push({
      toolName: 'get_my_hand',
      result: pv.myHand,
      timestamp: Date.now(),
    });
    toolTraces.push({
      toolName: 'get_dealer_upcard',
      result: pv.dealerUpcard,
      timestamp: Date.now(),
    });
  } else {
    const dv = view as DealerView;
    toolTraces.push({
      toolName: 'get_my_hand',
      result: dv.myHand,
      timestamp: Date.now(),
    });
  }

  // Try LLM, fallback to rules
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
