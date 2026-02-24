import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Strings, ThinkingLang } from './types';
import { THINKING_LANG_INSTRUCTIONS } from './types';
import { en } from './en';

interface LangContextValue {
  /** UI strings — always English */
  t: Strings;

  /** Per-agent thinking language */
  alexLang: ThinkingLang;
  dealerLang: ThinkingLang;
  setAlexLang: (lang: ThinkingLang) => void;
  setDealerLang: (lang: ThinkingLang) => void;

  /** Get langInstruction for a given ThinkingLang */
  getLangInstruction: (lang: ThinkingLang) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [alexLang, setAlexLang] = useState<ThinkingLang>('en');
  const [dealerLang, setDealerLang] = useState<ThinkingLang>('es');

  const t = en; // UI always English

  const getLangInstruction = useCallback(
    (lang: ThinkingLang) => THINKING_LANG_INSTRUCTIONS[lang],
    [],
  );

  return (
    <LangContext.Provider
      value={{ t, alexLang, dealerLang, setAlexLang, setDealerLang, getLangInstruction }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be inside LangProvider');
  return ctx;
}

// Template string replacement
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}
