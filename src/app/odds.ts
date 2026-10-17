/**
 * "What were the odds?" — computed once per reveal by the controller (never in
 * render) and formatted by a pure function so it can be unit-tested.
 *
 * Two numbers from the engine's Monte Carlo:
 *   - overall:  P(bid exists) in a pool of this size, nothing known.
 *   - fromSeat: the same, knowing the bidder's own hand.
 */
import type { Bid, Card, GameState, Rank } from "../engine";
import { bidLabel, bidOdds, countPool, estimateExists, explain, isWild, missingNaturals, mulberry32, rankLabel, suitSymbol } from "../engine";

/** One estimate; `exact` means the engine short-circuited (certain or impossible). */
export interface OddsNumber {
  readonly p: number;
  readonly exact: boolean;
}

export interface RevealOdds {
  readonly bid: Bid;
  readonly poolSize: number;
  readonly overall: OddsNumber;
  readonly fromSeat: OddsNumber;
  /** Name of the bidder, or null when the bidder is the human ("From your seat"). */
  readonly bidderName: string | null;
  /** The bidder's cards that counted toward the bid, e.g. "a 7", "two 7s and a wild"; null if none. */
  readonly held: string | null;
}

export const ODDS_TRIALS = 3000;
/** The question every odds line opens with; the UI renders it in bold. */
export const ODDS_QUESTION = "What were the odds?";

function oddsNumber(bid: Bid, known: readonly Card[], poolSize: number, seed: number): OddsNumber {
  const counts = countPool(known);
  const draws = poolSize - known.length;
  // Mirror the engine's exact shortcuts so the wording can say "certain"/"impossible" honestly.
  if (missingNaturals(bid, counts) <= counts.wilds) return { p: 1, exact: true };
  if (missingNaturals(bid, counts) > counts.wilds + draws || draws <= 0) return { p: 0, exact: true };
  // Nothing known: the engine's cached, deterministic table answers it.
  if (known.length === 0) return { p: bidOdds(bid, poolSize), exact: false };
  const p = estimateExists(bid, { known, poolSize, trials: ODDS_TRIALS, rng: mulberry32(seed) });
  return { p, exact: false };
}

/** Plain-English summary of the witness cards the bidder held: "a 7", "two Ks and a wild", "three ♥". */
export function describeHeld(bid: Bid, hand: readonly Card[]): string | null {
  const cards = explain(bid, hand).cards;
  if (cards.length === 0) return null;
  const wilds = cards.filter(isWild).length;
  const naturals = cards.filter((c) => c.kind === "natural");
  const parts: string[] = [];
  if (bid.category === "flush" || bid.category === "straightFlush") {
    if (naturals.length > 0) parts.push(`${count(naturals.length)} ${suitSymbol(bid.suit)}`);
  } else {
    const byRank = new Map<Rank, number>();
    for (const c of naturals) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
    for (const [rank, n] of [...byRank.entries()].sort((a, b) => b[0] - a[0])) {
      const label = rankLabel(rank);
      parts.push(n === 1 ? `${article(label)} ${label}` : `${count(n)} ${label}s`);
    }
  }
  if (wilds > 0) parts.push(wilds === 1 ? "a wild" : `${count(wilds)} wilds`);
  if (parts.length === 0) return null;
  if (parts.length > 3) return `${cards.length} of the cards`;
  return joinAnd(parts);
}

function count(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"][n] ?? String(n);
}

function article(label: string): string {
  // "an 8", "an A", "a 7", "a K", "a 10".
  return /^(8|A)$/.test(label) ? "an" : "a";
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Compute both numbers for the game's lastResult. Seeded so the line is identical on
 * every render of the same reveal (and in replays).
 */
export function computeRevealOdds(game: GameState, bidderName: string | null): RevealOdds | null {
  const r = game.lastResult;
  if (!r) return null;
  const hand = game.players[r.bidder]?.hand ?? [];
  const poolSize = r.pool.length;
  const seed = (game.round * 7919 + r.bidder * 131 + poolSize) >>> 0;
  return {
    bid: r.bid,
    poolSize,
    overall: oddsNumber(r.bid, [], poolSize, seed),
    fromSeat: oddsNumber(r.bid, hand, poolSize, seed ^ 0x9e3779b9),
    bidderName,
    held: describeHeld(r.bid, hand),
  };
}

/** "about 55%", "under 1%", "over 99%". Whole percents only. */
export function percentPhrase(p: number): string {
  if (p < 0.01) return "under 1%";
  if (p > 0.99) return "over 99%";
  return `about ${Math.round(p * 100)}%`;
}

/** The full line shown under the verdict. Pure; see odds.test.ts for the wording contract. */
export function formatOdds(o: RevealOdds): string {
  const what = `A ${bidLabel(o.bid)}`.replace(/^A ([AEIOU])/i, "An $1");
  const pool = `${numberArticle(o.poolSize)} ${o.poolSize}-card pool`;
  let first: string;
  if (o.overall.exact && o.overall.p === 0) first = `${what} was impossible in ${pool}.`;
  else if (o.overall.exact && o.overall.p === 1) first = `${what} was certain in ${pool}.`;
  else first = `${what} existed in ${pool} ${percentPhrase(o.overall.p)} of the time.`;

  const seat = o.bidderName == null ? "From your seat" : `From ${possessive(o.bidderName)} seat`;
  const holding = o.held ? ` (holding ${o.held})` : "";
  let second: string;
  if (o.fromSeat.exact && o.fromSeat.p === 1) second = `${seat}${holding}, it was a sure thing.`;
  else if (o.fromSeat.exact && o.fromSeat.p === 0) second = `${seat}${holding}, it was impossible.`;
  else second = `${seat}${holding}, it was ${percentPhrase(o.fromSeat.p)}.`;

  return `${ODDS_QUESTION} ${first} ${second}`;
}

/** "an 8-card", "an 11-card", "an 18-card", otherwise "a". */
function numberArticle(n: number): string {
  return n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89) ? "an" : "a";
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** "22%", "under 1%", "certain", "impossible": the number alone, for compact lines. */
export function shortPercent(n: OddsNumber): string {
  if (n.exact) return n.p >= 1 ? "certain" : "impossible";
  if (n.p < 0.01) return "under 1%";
  if (n.p > 0.99) return "over 99%";
  return `${Math.round(n.p * 100)}%`;
}

/**
 * The compact two-line odds readout on the Saloon reveal:
 *   "Odds it was there: 22%"
 *   "From Vega's seat (holding a 7): 41%"
 */
export function shortOdds(o: RevealOdds): { overall: string; seat: string } {
  const seat = o.bidderName == null ? "From your seat" : `From ${possessive(o.bidderName)} seat`;
  const holding = o.held ? ` (holding ${o.held})` : "";
  return {
    overall: `Odds it was there: ${shortPercent(o.overall)}`,
    seat: `${seat}${holding}: ${shortPercent(o.fromSeat)}`,
  };
}
