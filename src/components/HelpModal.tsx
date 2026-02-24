import { useState, useEffect } from 'react';
import { useLang } from '../i18n/LangContext';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useLang();
  const [tab, setTab] = useState<'rules' | 'demo'>('rules');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setTab((prev) => (prev === 'rules' ? 'demo' : 'rules'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const lines = tab === 'rules' ? t.help_rules : t.help_demo;

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-title">DEALER says...</div>

        <div className="help-tabs">
          <button
            className={`help-tab ${tab === 'rules' ? 'active' : ''}`}
            onClick={() => setTab('rules')}
          >
            {t.help_tab_rules}
          </button>
          <button
            className={`help-tab ${tab === 'demo' ? 'active' : ''}`}
            onClick={() => setTab('demo')}
          >
            {t.help_tab_demo}
          </button>
        </div>

        <div className="help-content">
          {lines.map((line, i) => (
            <div key={i} className="help-line">
              {line}
            </div>
          ))}
        </div>

        <div className="help-close">{t.help_close}</div>
      </div>
    </div>
  );
}
