import type { AIPlayerView, DealerView, LLMResponse } from '../game/types';
import type { ThinkingLang } from '../i18n/types';

// Basic Strategy simplified lookup
function basicStrategyDecision(playerTotal: number, dealerUpcard: number, isSoft: boolean): 'hit' | 'stand' {
  if (isSoft) {
    if (playerTotal >= 19) return 'stand';
    if (playerTotal === 18 && dealerUpcard >= 9) return 'hit';
    if (playerTotal === 18) return 'stand';
    return 'hit';
  }
  if (playerTotal >= 17) return 'stand';
  if (playerTotal >= 13 && dealerUpcard <= 6) return 'stand';
  if (playerTotal === 12 && dealerUpcard >= 4 && dealerUpcard <= 6) return 'stand';
  return 'hit';
}

const TEMPLATES: Record<ThinkingLang, Record<'hit' | 'stand', string>> = {
  en: {
    hit: "Hand is {value}, dealer shows {upcard}. Basic strategy says hit.",
    stand: "Hand is {value}. Safe enough — stand.",
  },
  kr: {
    hit: "핸드 {value}, 딜러 업카드 {upcard}. 기본 전략 — 히트.",
    stand: "핸드 {value}. 충분 — 스탠드.",
  },
  ja: {
    hit: "ハンドは{value}、ディーラーのアップカードは{upcard}。基本戦略に従いヒット。",
    stand: "ハンドは{value}。十分安全 — スタンド。",
  },
  es: {
    hit: "Mano en {value}, el crupier muestra {upcard}. Estrategia básica: pedir carta.",
    stand: "Mano en {value}. Suficiente — plantarse.",
  },
};

const DEALER_TEMPLATES: Record<ThinkingLang, Record<'hit' | 'stand', string>> = {
  en: {
    hit: "My hand totals {value}. House rules say I must hit.",
    stand: "Standing at {value}. House rules are clear.",
  },
  kr: {
    hit: "핸드 합계 {value}. 하우스 규칙에 따라 히트.",
    stand: "{value}에서 스탠드. 하우스 규칙 준수.",
  },
  ja: {
    hit: "ハンド合計{value}。ハウスルールに従いヒット。",
    stand: "{value}でスタンド。ハウスルール通り。",
  },
  es: {
    hit: "Mi mano suma {value}. Las reglas de la casa dicen que debo pedir.",
    stand: "Me planto en {value}. Las reglas de la casa son claras.",
  },
};

export function ruleBasedAIPlayer(view: AIPlayerView, lang: ThinkingLang): LLMResponse {
  const action = basicStrategyDecision(
    view.myHand.value,
    view.dealerUpcard.value,
    view.myHand.soft,
  );
  const template = TEMPLATES[lang][action];
  const thinking = template
    .replace('{value}', String(view.myHand.value))
    .replace('{upcard}', String(view.dealerUpcard.value));
  return { thinking, action };
}

export function ruleBasedDealer(view: DealerView, lang: ThinkingLang): LLMResponse {
  const action = view.myHand.value < 17 ? 'hit' : 'stand';
  const template = DEALER_TEMPLATES[lang][action];
  const thinking = template.replace('{value}', String(view.myHand.value));
  return { thinking, action };
}
