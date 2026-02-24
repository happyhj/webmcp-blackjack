import { useCallback } from 'react';
import type { ThinkingEntry, ToolTrace } from '../game/types';
import { useLang, fmt } from '../i18n/LangContext';
import { useTypewriter } from '../hooks/useTypewriter';

interface ThinkingPanelProps {
  entry: ThinkingEntry | null;
  label: string;
  visibleSteps: number;
  isComplete: boolean;
  onTypewriterDone: () => void;
}

/**
 * Format a tool result into a compact one-liner.
 * e.g. {cards: [...], value: 18, soft: false} → "18 (soft: no)"
 *      {card: {rank:"6",suit:"clubs"}, value: 6} → "6♣ = 6"
 */
function formatToolResult(toolName: string, result: unknown): string {
  try {
    const r = result as Record<string, unknown>;

    if (toolName === 'get_my_hand') {
      const value = r.value ?? '?';
      const soft = r.soft ? 'soft' : 'hard';
      const cards = Array.isArray(r.cards)
        ? r.cards.map((c: Record<string, string>) => formatCard(c)).join(' ')
        : '';
      return cards ? `${cards} = ${value} (${soft})` : `value: ${value}`;
    }

    if (toolName === 'get_dealer_upcard') {
      const card = r.card as Record<string, string> | undefined;
      const value = r.value ?? '?';
      return card ? `${formatCard(card)} = ${value}` : `value: ${value}`;
    }

    if (toolName === 'reveal_hidden') {
      const card = r.card as Record<string, string> | undefined;
      return card ? `${formatCard(card)} revealed` : 'revealed';
    }

    // Fallback: compact JSON
    const json = JSON.stringify(result);
    return json.length > 60 ? json.slice(0, 57) + '...' : json;
  } catch {
    return JSON.stringify(result);
  }
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

function formatCard(card: Record<string, string>): string {
  const suit = SUIT_SYMBOLS[card.suit] ?? card.suit ?? '';
  return `${card.rank ?? '?'}${suit}`;
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

  const flag = entry.langFlag ? ` ${entry.langFlag}` : '';
  const toolCount = entry.toolTraces.length;
  const totalAvailable = entry.availableTools.length;

  const reasoningVisible = visibleSteps > toolCount;
  const decisionVisible = visibleSteps > toolCount + 1;

  return (
    <div className="thinking-panel">
      {/* Header — agentic loop indicator */}
      <div className="panel-header">
        <span className="agent-loop-badge">agent loop</span>
        {' '}
        {label}{flag}
        <span className="agent-loop-meta">
          {' '}— {fmt(t.agent_tools_available, { n: String(totalAvailable) })}
        </span>
      </div>

      {/* Tool traces — each shows as a model-initiated call */}
      {entry.toolTraces.map((trace, i) =>
        i < visibleSteps ? (
          <AgentToolCall
            key={i}
            trace={trace}
            turnNumber={i + 1}
            t={t}
          />
        ) : null
      )}

      {/* If model made 0 tool calls (direct decision) */}
      {toolCount === 0 && reasoningVisible && (
        <div className="tool-trace-skip slide-in">
          {t.agent_no_tools}
        </div>
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

/** Single tool call line — shows as "model chose to call this" */
function AgentToolCall({
  trace,
  turnNumber,
  t,
}: {
  trace: ToolTrace;
  turnNumber: number;
  t: Record<string, unknown>;
}) {
  const compactResult = formatToolResult(trace.toolName, trace.result);

  return (
    <div className="tool-trace slide-in">
      <span className="agent-turn-num">#{turnNumber}</span>
      {' '}
      <span className="agent-arrow">{(t as Record<string, string>).agent_calls ?? 'Agent →'}</span>
      {' '}
      <span className="agent-tool-name">{trace.toolName}()</span>
      <div className="agent-tool-result">
        └ {compactResult}
      </div>
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
