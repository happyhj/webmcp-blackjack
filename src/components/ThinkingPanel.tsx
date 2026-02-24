import { useCallback } from 'react';
import type { ThinkingEntry } from '../game/types';
import { useLang, fmt } from '../i18n/LangContext';
import { useTypewriter } from '../hooks/useTypewriter';

interface ThinkingPanelProps {
  entry: ThinkingEntry | null;
  label: string;
  visibleSteps: number;
  isComplete: boolean;
  onTypewriterDone: () => void;
}

export function ThinkingPanel({
  entry,
  label,
  visibleSteps,
  isComplete,
  onTypewriterDone,
}: ThinkingPanelProps) {
  const { t } = useLang();

  if (!entry) return null;

  const toolsStr = entry.availableTools.join(', ');
  const flag = entry.langFlag ? ` ${entry.langFlag}` : '';
  const header = fmt(t.thinking_header, { name: `${label}${flag}`, tools: toolsStr });
  const toolCount = entry.toolTraces.length;

  const reasoningVisible = visibleSteps > toolCount;
  const decisionVisible = visibleSteps > toolCount + 1;

  return (
    <div className="thinking-panel">
      <div className="panel-header">{header}</div>

      {/* Tool traces — slide in one by one */}
      {entry.toolTraces.map((trace, i) =>
        i < visibleSteps ? (
          <div key={i} className="tool-trace slide-in">
            {fmt(t.tool_call, { tool: trace.toolName })}{' '}
            <span style={{ opacity: 0.5 }}>
              → {JSON.stringify(trace.result)}
            </span>
          </div>
        ) : null
      )}

      {/* Reasoning — typewriter effect */}
      {reasoningVisible && (
        <ReasoningLine
          text={entry.reasoning}
          isFallback={entry.isFallback}
          fallbackTag={t.fallback_tag}
          thinkingLabel={t.thinking_label}
          onDone={onTypewriterDone}
        />
      )}

      {/* Decision — glitch + pulse entrance */}
      {decisionVisible && (
        <div className="action-badge decision-reveal">
          {fmt(t.decision, { action: entry.action.type.toUpperCase() })}
        </div>
      )}

      {/* Step prompt — press SPACE to skip */}
      {!isComplete && (
        <div className="step-prompt">{t.step_prompt}</div>
      )}
    </div>
  );
}

/** Sub-component so useTypewriter hook is called at the right level */
function ReasoningLine({
  text,
  isFallback,
  fallbackTag,
  thinkingLabel,
  onDone,
}: {
  text: string;
  isFallback: boolean;
  fallbackTag: string;
  thinkingLabel: string;
  onDone: () => void;
}) {
  // Stabilize the callback reference so useTypewriter doesn't re-trigger
  const stableOnDone = useCallback(onDone, []); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = useTypewriter(text, true, 22, stableOnDone);
  const isDone = typed.length >= text.length;

  return (
    <div className="reasoning">
      <span style={{ color: 'var(--accent)' }}>{thinkingLabel}</span>{' '}
      <span>{typed}</span>
      {!isDone && <span className="typewriter-cursor">▌</span>}
      {isFallback && isDone && (
        <span className="fallback-tag"> {fallbackTag}</span>
      )}
    </div>
  );
}
