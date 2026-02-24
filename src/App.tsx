import { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { gameReducer, createInitialState } from './game/reducer';
import { determineResult, mustDealerHit } from './game/rules';
import { runAgentTurn } from './agents/agent-runner';
import type { ThinkingEntry } from './game/types';
import { useLang, fmt } from './i18n/LangContext';
import { useStepThrough } from './hooks/useStepThrough';
import { AsciiHand } from './components/AsciiHand';
import { ThinkingPanel } from './components/ThinkingPanel';
import { HelpModal } from './components/HelpModal';
import { GameLog } from './components/GameLog';
import { ResultScreen } from './components/ResultScreen';
import { THINKING_LANG_OPTIONS } from './i18n/types';
import { LangSelect } from './components/LangSelect';
import { trackGameStart, trackRoundComplete, trackLangChange, trackHelpOpen } from './analytics';
import './styles/terminal.css';

const BET_OPTIONS = [25, 50, 100, 200];

export default function App() {
  const { t, alexLang, dealerLang, setAlexLang, setDealerLang, getLangInstruction } = useLang();
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [selectedBet, setSelectedBet] = useState(50);
  const [selectedAction, setSelectedAction] = useState<'hit' | 'stand'>('hit');
  const [helpOpen, setHelpOpen] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<ThinkingEntry | null>(null);
  const processingRef = useRef(false);
  const [processingTick, setProcessingTick] = useState(0);

  const { visibleSteps, isComplete, waitForCompletion, signalTypewriterDone } = useStepThrough(currentThinking);

  const showThinkingAndWait = useCallback(async (entry: ThinkingEntry) => {
    setCurrentThinking(entry);
    dispatch({ type: 'ADD_THINKING', entry });
    const completionPromise = waitForCompletion();
    await completionPromise;
    setCurrentThinking(null);
  }, [waitForCompletion]);

  const finishProcessing = useCallback(() => {
    processingRef.current = false;
    setProcessingTick((t) => t + 1);
  }, []);

  // Phase status text
  const phaseText = (() => {
    switch (state.phase) {
      case 'idle':
      case 'betting': return t.phase_betting;
      case 'player_turn': return t.phase_player;
      case 'ai_turn': return t.phase_ai;
      case 'dealer_turn': return t.phase_dealer;
      default: return '';
    }
  })();

  const addLog = useCallback(
    (message: string, type: 'info' | 'action' | 'result' | 'error' = 'info') => {
      dispatch({ type: 'ADD_LOG', entry: { message, type } });
    },
    [],
  );

  const startRound = useCallback(() => {
    if (state.roundNumber === 0) trackGameStart();
    dispatch({ type: 'START_ROUND' });
  }, [state.roundNumber]);

  const placeBetAndDeal = useCallback(() => {
    dispatch({ type: 'PLACE_BET', role: 'player', amount: selectedBet });
    dispatch({ type: 'PLACE_BET', role: 'ai_player', amount: selectedBet });
    dispatch({ type: 'DEAL_INITIAL' });
    dispatch({ type: 'SET_PHASE', phase: 'player_turn' });
    dispatch({ type: 'SET_TURN', role: 'player' });
  }, [selectedBet]);

  const playerHit = useCallback(() => {
    dispatch({ type: 'HIT', role: 'player' });
  }, []);

  const playerStand = useCallback(() => {
    dispatch({ type: 'STAND', role: 'player' });
  }, []);

  // After player busts, stands, or hits blackjack → move to AI turn
  // Reset action focus when player turn starts
  useEffect(() => {
    if (state.phase === 'player_turn') setSelectedAction('hit');
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'player_turn') return;
    const p = state.player;
    if (p.status === 'blackjack') {
      addLog(fmt(t.log_blackjack, { role: t.role_player }), 'action');
      setTimeout(() => {
        dispatch({ type: 'SET_PHASE', phase: 'ai_turn' });
        dispatch({ type: 'SET_TURN', role: 'ai_player' });
      }, 800);
    } else if (p.status === 'bust') {
      addLog(fmt(t.log_bust, { role: t.role_player, value: String(p.hand.value.best) }), 'action');
      setTimeout(() => {
        dispatch({ type: 'SET_PHASE', phase: 'ai_turn' });
        dispatch({ type: 'SET_TURN', role: 'ai_player' });
      }, 500);
    } else if (p.status === 'stand') {
      addLog(fmt(t.log_stand, { role: t.role_player }), 'action');
      setTimeout(() => {
        dispatch({ type: 'SET_PHASE', phase: 'ai_turn' });
        dispatch({ type: 'SET_TURN', role: 'ai_player' });
      }, 300);
    }
  }, [state.player.status, state.phase]);

  const moveToDealerTurn = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'dealer_turn' });
    dispatch({ type: 'SET_TURN', role: 'dealer' });
  }, []);

  // AI turn
  useEffect(() => {
    if (state.phase !== 'ai_turn' || processingRef.current) return;
    if (state.aiPlayer.status === 'blackjack') {
      addLog(fmt(t.log_blackjack, { role: t.role_ai }), 'action');
      setTimeout(moveToDealerTurn, 500);
      return;
    }
    if (state.aiPlayer.status !== 'active') {
      moveToDealerTurn();
      return;
    }
    processingRef.current = true;
    const runAI = async () => {
      try {
        const entry = await runAgentTurn('ai_player', state, dispatch, getLangInstruction(alexLang), alexLang);
        await showThinkingAndWait(entry);
        dispatch({ type: entry.action.type === 'hit' ? 'HIT' : 'STAND', role: 'ai_player' });
        if (entry.action.type === 'hit') {
          addLog(fmt(t.log_hit, { role: t.role_ai, card: '?' }), 'action');
        } else {
          addLog(fmt(t.log_stand, { role: t.role_ai }), 'action');
        }
        finishProcessing();
        if (entry.action.type === 'stand') moveToDealerTurn();
      } catch (err) {
        console.error('[AI Turn] Unexpected error:', err);
        setCurrentThinking(null);
        finishProcessing();
        moveToDealerTurn();
      }
    };
    runAI();
  }, [state.phase, state.aiPlayer.hand.cards.length, state.aiPlayer.status, processingTick]);

  useEffect(() => {
    if (state.phase !== 'ai_turn') return;
    if (state.aiPlayer.status === 'bust' && !processingRef.current) {
      addLog(fmt(t.log_bust, { role: t.role_ai, value: String(state.aiPlayer.hand.value.best) }), 'action');
      setTimeout(moveToDealerTurn, 500);
    }
  }, [state.aiPlayer.status, state.phase, processingTick]);

  // Dealer turn
  useEffect(() => {
    if (state.phase !== 'dealer_turn' || processingRef.current) return;
    if (!state.dealerHiddenRevealed) {
      dispatch({ type: 'REVEAL_DEALER_HIDDEN' });
      return;
    }
    if (state.dealer.status === 'blackjack') {
      addLog(fmt(t.log_blackjack, { role: t.role_dealer }), 'action');
      setTimeout(() => dispatch({ type: 'SET_PHASE', phase: 'settling' }), 500);
      return;
    }
    if (state.dealer.status === 'bust' || state.dealer.status === 'stand') {
      dispatch({ type: 'SET_PHASE', phase: 'settling' });
      return;
    }
    if (!mustDealerHit(state.dealer.hand)) {
      addLog(fmt(t.log_stand, { role: t.role_dealer }), 'action');
      dispatch({ type: 'STAND', role: 'dealer' });
      return;
    }
    processingRef.current = true;
    const runDealer = async () => {
      try {
        const entry = await runAgentTurn('dealer', state, dispatch, getLangInstruction(dealerLang), dealerLang);
        await showThinkingAndWait(entry);
        dispatch({ type: entry.action.type === 'hit' ? 'HIT' : 'STAND', role: 'dealer' });
        addLog(fmt(t.log_hit, { role: t.role_dealer, card: '?' }), 'action');
        finishProcessing();
      } catch (err) {
        console.error('[Dealer Turn] Unexpected error:', err);
        setCurrentThinking(null);
        finishProcessing();
        dispatch({ type: 'SET_PHASE', phase: 'settling' });
      }
    };
    runDealer();
  }, [state.phase, state.dealerHiddenRevealed, state.dealer.hand.cards.length, state.dealer.status, processingTick]);

  // Settle
  useEffect(() => {
    if (state.phase !== 'settling') return;
    const result = determineResult(state.player.hand, state.dealer.hand);
    if (result === 'win' || result === 'blackjack_win') {
      addLog(fmt(t.log_result_win, { amount: String(state.player.bet) }), 'result');
    } else if (result === 'lose') {
      addLog(fmt(t.log_result_lose, { amount: String(state.player.bet) }), 'result');
    } else {
      addLog(t.log_result_push, 'result');
    }
    trackRoundComplete(state.roundNumber);
    dispatch({ type: 'SETTLE_ROUND' });
  }, [state.phase]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (helpOpen) return;
      if (e.code === 'Space') return;
      if (state.phase === 'idle' && e.key === 'Enter') startRound();
      else if (state.phase === 'betting') {
        if (e.key === 'Enter') placeBetAndDeal();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedBet((prev) => {
            const idx = BET_OPTIONS.indexOf(prev);
            if (e.key === 'ArrowLeft') return BET_OPTIONS[Math.max(0, idx - 1)];
            return BET_OPTIONS[Math.min(BET_OPTIONS.length - 1, idx + 1)];
          });
        }
      }
      else if (state.phase === 'player_turn' && state.player.status === 'active') {
        if (e.key === 'h' || e.key === 'H' || e.code === 'KeyH') playerHit();
        else if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') playerStand();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedAction((prev) => prev === 'hit' ? 'stand' : 'hit');
        } else if (e.key === 'Enter') {
          if (selectedAction === 'hit') playerHit();
          else playerStand();
        }
      } else if (state.phase === 'round_end' && e.key === 'Enter') startRound();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.phase, state.player.status, helpOpen, startRound, placeBetAndDeal, playerHit, playerStand, selectedAction]);

  const playerResult =
    state.phase === 'round_end'
      ? determineResult(state.player.hand, state.dealer.hand)
      : null;

  const dealerHidden =
    !state.dealerHiddenRevealed && state.dealer.hand.cards.length > 0
      ? [0]
      : [];

  const isPreDeal = state.phase === 'betting';
  const showTable = state.phase !== 'idle';

  return (
    <div>
      {/* Header */}
      <div className="header-bar">
        <span className="title clickable" onClick={() => dispatch({ type: 'RESET' })}>♠ WebMCP Blackjack</span>
        <div className="controls">
          {/* Desktop: inline flag buttons */}
          <span className="agent-lang-group desktop-only">
            <span className="agent-lang-label">Alex</span>
            {THINKING_LANG_OPTIONS.map((opt) => (
              <button
                key={`alex-${opt.code}`}
                className={`flag-btn ${alexLang === opt.code ? 'active' : ''}`}
                onClick={() => { setAlexLang(opt.code); trackLangChange('alex', opt.code); }}
                title={`Alex thinks in ${opt.label}`}
              >
                {opt.flag}
              </button>
            ))}
          </span>
          <span className="agent-lang-group desktop-only">
            <span className="agent-lang-label">Dealer</span>
            {THINKING_LANG_OPTIONS.map((opt) => (
              <button
                key={`dealer-${opt.code}`}
                className={`flag-btn ${dealerLang === opt.code ? 'active' : ''}`}
                onClick={() => { setDealerLang(opt.code); trackLangChange('dealer', opt.code); }}
                title={`Dealer thinks in ${opt.label}`}
              >
                {opt.flag}
              </button>
            ))}
          </span>
          {/* Mobile: dropdown selects */}
          <LangSelect
            agent="Alex"
            value={alexLang}
            onChange={(lang) => { setAlexLang(lang); trackLangChange('alex', lang); }}
          />
          <LangSelect
            agent="Dealer"
            value={dealerLang}
            onChange={(lang) => { setDealerLang(lang); trackLangChange('dealer', lang); }}
          />
          <button className="help-btn" onClick={() => { setHelpOpen(true); trackHelpOpen(); }}>
            {t.help_button}
          </button>
        </div>
      </div>

      {/* Idle — welcome */}
      {state.phase === 'idle' && (
        <div className="welcome-screen">
          <pre className="welcome-art">{`
  ♠ ♥ ♦ ♣
  WebMCP Blackjack
  ♣ ♦ ♥ ♠`}</pre>
          <p className="welcome-desc">
            Same tools, different permissions — watch two AI agents
            play blackjack under WebMCP's role-based tool access.
            Observe real-time tool calls, information asymmetry,
            and multilingual reasoning in action.
          </p>
          <button className="btn primary" onClick={startRound}>
            [ ENTER to start ]
          </button>
        </div>
      )}

      {/* Table — visible from betting onwards */}
      {showTable && (
        <>
          {/* Status bar */}
          <div className="status-bar">
            <span>{fmt(t.round, { n: String(state.roundNumber) })}</span>
            <span className="phase-label">{phaseText}</span>
            <span>
              {t.chips}: {state.player.chips}{!isPreDeal ? ` | ${t.bet}: ${state.player.bet}` : ''}
            </span>
          </div>

          {/* Dealer */}
          <div className="section">
            <AsciiHand
              hand={state.dealer.hand}
              hiddenIndices={dealerHidden}
              label={t.role_dealer}
              showEmpty={isPreDeal}
            />
            {state.phase === 'dealer_turn' && currentThinking?.role === 'dealer' && (
              <ThinkingPanel
                entry={currentThinking}
                label={t.role_dealer}
                visibleSteps={visibleSteps}
                isComplete={isComplete}
                onTypewriterDone={signalTypewriterDone}
              />
            )}
          </div>

          {/* AI Player (Alex) */}
          <div className="section">
            <AsciiHand
              hand={state.aiPlayer.hand}
              label={t.role_ai}
              showEmpty={isPreDeal}
            />
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
              {t.chips}: {state.aiPlayer.chips}
            </div>
            {state.phase === 'ai_turn' && currentThinking?.role === 'ai_player' && (
              <ThinkingPanel
                entry={currentThinking}
                label={t.role_ai}
                visibleSteps={visibleSteps}
                isComplete={isComplete}
                onTypewriterDone={signalTypewriterDone}
              />
            )}
          </div>

          {/* Player (You) */}
          <div className="section">
            <AsciiHand
              hand={state.player.hand}
              label={t.role_player}
              showEmpty={isPreDeal}
            />

            {/* Betting — inline in player section */}
            {state.phase === 'betting' && (
              <div className="inline-betting">
                <div className="bet-row">
                  {BET_OPTIONS.map((amt) => (
                    <button
                      key={amt}
                      className={`bet-chip ${selectedBet === amt ? 'selected' : ''}`}
                      onClick={() => setSelectedBet(amt)}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <button className="btn primary deal-btn" onClick={placeBetAndDeal}>
                  {t.place_bet} [ ENTER ]
                </button>
              </div>
            )}

            {/* Player actions during game */}
            {state.phase === 'player_turn' && state.player.status === 'active' && (
              <div className="player-controls">
                <button
                  className={`btn ${selectedAction === 'hit' ? 'focused' : ''}`}
                  onClick={playerHit}
                >
                  {t.hit}
                </button>
                <button
                  className={`btn ${selectedAction === 'stand' ? 'focused' : ''}`}
                  onClick={playerStand}
                >
                  {t.stand}
                </button>
              </div>
            )}
          </div>

          {/* Game Log */}
          {state.log.length > 0 && <GameLog entries={state.log} />}
        </>
      )}

      {/* Result overlay */}
      {state.phase === 'round_end' && playerResult && (
        <ResultScreen
          playerResult={playerResult}
          playerBet={state.player.bet}
          player={state.player}
          aiPlayer={state.aiPlayer}
          dealer={state.dealer}
          onNextRound={startRound}
        />
      )}

      {/* Help modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Footer */}
      <footer className="footer">
        <a href="https://github.com/happyhj/webmcp-blackjack" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span> · MIT · </span>
        <a href="https://happyhj.github.io" target="_blank" rel="noopener noreferrer">
          Heejae Kim
        </a>
        <span> · </span>
        <a href="https://www.linkedin.com/in/heejaekm/" target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
      </footer>
    </div>
  );
}
