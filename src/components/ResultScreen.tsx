import { useLang, fmt } from '../i18n/LangContext';
import type { RoundResult, Participant } from '../game/types';
import { determineResult } from '../game/rules';
import { cardToString } from '../ascii/card-renderer';

interface ResultScreenProps {
  playerResult: RoundResult;
  playerBet: number;
  player: Participant;
  aiPlayer: Participant;
  dealer: Participant;
  onNextRound: () => void;
}

function handSummary(p: Participant): string {
  const cards = p.hand.cards.map(cardToString).join(' ');
  const value = p.hand.value.best;
  if (p.hand.value.isBlackjack) return `${cards}  (BJ!)`;
  if (p.hand.value.isBust) return `${cards}  (${value} BUST)`;
  return `${cards}  (${value})`;
}

function resultTag(result: RoundResult): { text: string; cls: string } {
  switch (result) {
    case 'blackjack_win': return { text: 'BLACKJACK!', cls: 'tag-win' };
    case 'win': return { text: 'WIN', cls: 'tag-win' };
    case 'lose': return { text: 'LOSE', cls: 'tag-lose' };
    case 'push':
    case 'blackjack_push': return { text: 'PUSH', cls: 'tag-push' };
  }
}

function resultReason(
  result: RoundResult,
  playerVal: number,
  dealerVal: number,
  playerBust: boolean,
  dealerBust: boolean,
  t: Record<string, string>,
): string {
  if (result === 'blackjack_win') return t.reason_blackjack;
  if (result === 'blackjack_push') return t.reason_both_blackjack;
  if (playerBust) return t.reason_player_bust;
  if (dealerBust) return fmt(t.reason_dealer_bust, { value: String(dealerVal) });
  if (result === 'win') return fmt(t.reason_higher, { player: String(playerVal), dealer: String(dealerVal) });
  if (result === 'lose') return fmt(t.reason_lower, { player: String(playerVal), dealer: String(dealerVal) });
  return fmt(t.reason_tie, { value: String(playerVal) });
}

export function ResultScreen({
  playerResult,
  playerBet,
  player,
  aiPlayer,
  dealer,
  onNextRound,
}: ResultScreenProps) {
  const { t } = useLang();

  const aiResult = determineResult(aiPlayer.hand, dealer.hand);
  const playerTag = resultTag(playerResult);
  const aiTag = resultTag(aiResult);

  const reason = resultReason(
    playerResult,
    player.hand.value.best,
    dealer.hand.value.best,
    player.hand.value.isBust,
    dealer.hand.value.isBust,
    t as unknown as Record<string, string>,
  );

  const payout = (() => {
    switch (playerResult) {
      case 'blackjack_win': return `+${Math.floor(playerBet * 1.5)}`;
      case 'win': return `+${playerBet}`;
      case 'lose': return `-${playerBet}`;
      default: return '±0';
    }
  })();

  return (
    <div className="result-overlay" onClick={onNextRound}>
      <div className="result-card">
        {/* Big result banner */}
        <div className={`result-banner ${playerTag.cls}`}>
          {playerTag.text}
        </div>

        <div className="result-reason">{reason}</div>

        {/* Scoreboard */}
        <div className="result-scoreboard">
          <div className="result-row">
            <span className="result-role">{t.role_dealer}</span>
            <span className="result-hand">{handSummary(dealer)}</span>
          </div>
          <div className="result-divider" />
          <div className="result-row you">
            <span className="result-role">{t.role_player} <span className={playerTag.cls}>[{playerTag.text}]</span></span>
            <span className="result-hand">{handSummary(player)}</span>
          </div>
          <div className="result-row">
            <span className="result-role">{t.role_ai} <span className={aiTag.cls}>[{aiTag.text}]</span></span>
            <span className="result-hand">{handSummary(aiPlayer)}</span>
          </div>
        </div>

        {/* Payout */}
        <div className={`result-payout ${playerTag.cls}`}>
          {payout} chips
        </div>

        <div className="result-prompt">{t.new_round}</div>
      </div>
    </div>
  );
}
