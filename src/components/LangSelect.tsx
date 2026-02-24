import { useState, useRef, useEffect } from 'react';
import { THINKING_LANG_OPTIONS } from '../i18n/types';
import type { ThinkingLang } from '../i18n/types';

interface LangSelectProps {
  agent: string;
  value: ThinkingLang;
  onChange: (lang: ThinkingLang) => void;
}

export function LangSelect({ agent, value, onChange }: LangSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = THINKING_LANG_OPTIONS.find((o) => o.code === value);

  return (
    <div className="lang-select" ref={ref}>
      <button className="lang-select-trigger" onClick={() => setOpen(!open)}>
        <span className="agent-lang-label">{agent}</span>
        <span className="lang-select-flag">{current?.flag}</span>
      </button>
      {open && (
        <div className="lang-select-dropdown">
          {THINKING_LANG_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              className={`lang-select-option ${value === opt.code ? 'active' : ''}`}
              onClick={() => { onChange(opt.code); setOpen(false); }}
            >
              {opt.flag} {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
