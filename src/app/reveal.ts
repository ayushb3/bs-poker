/** Wording and numbers for the reveal and game-over screens. No DOM. */
import type { GameState, RoundResult } from "../engine";
import { bidLabel } from "../engine";

export interface PlayerRef {
  readonly name: (seat: number) => string;
  readonly human: number;
}

export interface RevealText {
  readonly headline: string;
  readonly verdictTitle: string;
  readonly loserLine: string;
  readonly outLine: string | null;
  readonly youLine: string | null;
}

export function revealText(game: GameState, r: RoundResult, who: PlayerRef): RevealText {
  const you = who.human;
  const loserNow = game.players[r.loser]?.cardCount ?? 0;
  return {
    headline: `${who.name(r.caller)} called BS on ${r.bidder === you ? "your" : `${who.name(r.bidder)}'s`} ${bidLabel(r.bid)}`,
    verdictTitle: r.existed ? "It was there!" : "It wasn't there.",
    loserLine: `${who.name(r.loser)} ${r.loser === you ? "take" : "takes"} +1 card (now ${loserNow}).`,
    outLine:
      r.eliminated.length > 0
        ? r.eliminated.map((e) => `${who.name(e)} ${e === you ? "are" : "is"} out at ${game.config.cardCap} cards.`).join(" ")
        : null,
    youLine: r.loser === you ? "Ouch." : r.caller === you || r.bidder === you ? "Nice one." : null,
  };
}

/** Final standings: survivors first, then fewest cards. */
export function standings(game: GameState): GameState["players"] {
  return [...game.players].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || a.cardCount - b.cardCount);
}
