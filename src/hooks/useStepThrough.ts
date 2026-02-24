import { useState, useEffect, useCallback, useRef } from 'react';
import type { ThinkingEntry } from '../game/types';

/** Pause after typewriter finishes before showing decision */
const POST_TYPEWRITER_PAUSE = 800;

/**
 * Hearthstone-paced auto-advance for thinking steps.
 *
 * Step map (for toolCount=2, totalSteps=4):
 *   vs=0  → nothing visible          → [1500ms] auto-advance
 *   vs=1  → trace[0]                 → [1500ms] auto-advance
 *   vs=2  → trace[0,1]              → [300ms]  auto-advance (brief pause before reasoning)
 *   vs=3  → traces + reasoning       → WAIT for signalTypewriterDone → [800ms] → advance
 *   vs=4  → traces + reasoning + decision → isComplete → [2000ms settle] → done
 *
 * Visibility rules in ThinkingPanel:
 *   trace[i]   visible when  i < visibleSteps
 *   reasoning  visible when  visibleSteps > toolCount
 *   decision   visible when  visibleSteps > toolCount + 1
 *
 * SPACE key instantly advances to the next step.
 */
export function useStepThrough(entry: ThinkingEntry | null) {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const completionRef = useRef<(() => void) | null>(null);

  const totalSteps = entry ? entry.toolTraces.length + 2 : 0;
  const isComplete = entry ? visibleSteps >= totalSteps : false;
  const toolCount = entry ? entry.toolTraces.length : 0;

  // Reasoning is visible AND typewriter is running at this step
  const isTypewriterRunning = entry != null && visibleSteps === toolCount + 1;

  // Reset when entry changes
  useEffect(() => {
    setVisibleSteps(0);
  }, [entry]);

  // Auto-advance for steps that DON'T need to wait for typewriter
  useEffect(() => {
    if (!entry || isComplete || isTypewriterRunning) return;

    let delay: number;
    if (visibleSteps < toolCount) {
      delay = 1500;  // tool trace display time
    } else if (visibleSteps === toolCount) {
      delay = 300;   // brief pause before reasoning appears
    } else {
      delay = 1500;  // decision display time
    }

    const timer = setTimeout(() => {
      setVisibleSteps((v) => v + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [entry, visibleSteps, isComplete, isTypewriterRunning, toolCount]);

  // Called by ThinkingPanel when typewriter finishes
  const signalTypewriterDone = useCallback(() => {
    if (!isTypewriterRunning) return;
    const timer = setTimeout(() => {
      setVisibleSteps((v) => v + 1);
    }, POST_TYPEWRITER_PAUSE);
    return () => clearTimeout(timer);
  }, [isTypewriterRunning]);

  // When complete, settle pause then call completion callback
  useEffect(() => {
    if (!isComplete || !entry) return;
    const timer = setTimeout(() => {
      if (completionRef.current) {
        completionRef.current();
        completionRef.current = null;
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isComplete, entry]);

  const advance = useCallback(() => {
    if (!isComplete) {
      setVisibleSteps((v) => v + 1);
    }
  }, [isComplete]);

  // SPACE key to skip ahead
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && entry && !isComplete) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, isComplete, entry]);

  /** Returns a Promise that resolves after all steps + settle pause. */
  const waitForCompletion = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      completionRef.current = resolve;
    });
  }, []);

  return {
    visibleSteps,
    totalSteps,
    isComplete,
    advance,
    waitForCompletion,
    signalTypewriterDone,
  };
}
