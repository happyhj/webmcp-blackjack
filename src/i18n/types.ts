export type Lang = 'en' | 'kr';

/** Languages available for agent thinking output */
export type ThinkingLang = 'en' | 'kr' | 'ja' | 'es';

export interface ThinkingLangOption {
  code: ThinkingLang;
  flag: string;
  label: string;
}

export const THINKING_LANG_OPTIONS: ThinkingLangOption[] = [
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'kr', flag: '🇰🇷', label: 'KR' },
  { code: 'ja', flag: '🇯🇵', label: 'JA' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
];

export const THINKING_LANG_INSTRUCTIONS: Record<ThinkingLang, string> = {
  en: 'You MUST write your "thinking" field in English.',
  kr: 'You MUST write your "thinking" field in Korean (한국어). Example: {"thinking": "핸드가 15이고 딜러가 10을 보여주니까 히트해야겠어.", "action": "hit"}',
  ja: 'You MUST write your "thinking" field in Japanese (日本語). Example: {"thinking": "ハンドが15でディーラーが10を見せているからヒットだ。", "action": "hit"}',
  es: 'You MUST write your "thinking" field in Spanish (español). Example: {"thinking": "Mi mano es 15 y el crupier muestra 10, debo pedir carta.", "action": "hit"}',
};

export interface Strings {
  // Game status
  round: string;
  chips: string;
  bet: string;
  phase_betting: string;
  phase_player: string;
  phase_ai: string;
  phase_dealer: string;

  // Player controls
  hit: string;
  stand: string;
  double: string;
  place_bet: string;

  // Thinking panel
  thinking_header: string;
  tool_call: string;
  thinking_label: string;
  decision: string;
  fallback_tag: string;
  step_prompt: string;

  // Game log
  log_deal: string;
  log_hit: string;
  log_stand: string;
  log_bust: string;
  log_blackjack: string;
  log_result_win: string;
  log_result_lose: string;
  log_result_push: string;

  // Role names
  role_player: string;
  role_ai: string;
  role_dealer: string;

  // Result screen
  result_win: string;
  result_lose: string;
  result_push: string;
  result_bust: string;
  new_round: string;

  // Result reasons
  reason_blackjack: string;
  reason_both_blackjack: string;
  reason_player_bust: string;
  reason_dealer_bust: string;
  reason_higher: string;
  reason_lower: string;
  reason_tie: string;

  // Help modal
  help_button: string;
  help_tab_rules: string;
  help_tab_demo: string;
  help_rules: string[];
  help_demo: string[];
  help_close: string;
}
