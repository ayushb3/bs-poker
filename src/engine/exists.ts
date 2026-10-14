/**
 * Does a bid exist in a pool? (SPEC "Engine".)
 *
 * W = number of wild cards in the pool. A bid exists when the natural cards it is
 * missing can all be covered by wilds:
 *   n-of-a-kind r      : count(r) + W >= n            (high 1, pair 2, trips 3, quads 4, five 5)
 *   two pair a over b  : max(0, 2-count(a)) + max(0, 2-count(b)) <= W
 *   full house a over b: max(0, 3-count(a)) + max(0, 2-count(b)) <= W
 *   straight to h      : #ranks in h-4..h with no natural card <= W
 *   flush in s         : count(naturals of suit s) + W >= 5
 *   straight flush h,s : #ranks in h-4..h with no natural of suit s <= W
 *
 * This matches ex2() in docs/bsp2.py, which produced the SPEC §2 table.
 */
import { rankLabel, suitSymbol } from "./deck";
import { isWild, type Bid, type Card, type Explanation, type Rank, type Suit } from "./types";

/* ------------------------------------------------------------------------ */
/* Fast path: pool summarised as counts. Used by exists() and by odds.ts.   */
/* ------------------------------------------------------------------------ */

const SUIT_INDEX: Readonly<Record<Suit, number>> = { c: 0, d: 1, h: 2, s: 3 };

/**
 * Summary of a pool that is enough to answer every bid.
 * - rankCount[r]: naturals of rank r (indices 0..2 unused).
 * - suitCount[s]: naturals of suit s (index per SUIT_INDEX).
 * - suitRanks[s]: bitmask of ranks present in suit s (bit r set when a natural (r, s) is in the pool).
 * - wilds: W.
 */
export interface PoolCounts {
  readonly rankCount: Uint8Array;
  readonly suitCount: Uint8Array;
  readonly suitRanks: Uint16Array;
  wilds: number;
}

export function emptyCounts(): PoolCounts {
  return { rankCount: new Uint8Array(15), suitCount: new Uint8Array(4), suitRanks: new Uint16Array(4), wilds: 0 };
}

/** Mutates `counts` by adding one card. Exposed for the Monte Carlo loop. */
export function addCard(counts: PoolCounts, card: Card): void {
  if (card.kind === "natural") {
    const s = SUIT_INDEX[card.suit];
    counts.rankCount[card.rank] = (counts.rankCount[card.rank] ?? 0) + 1;
    counts.suitCount[s] = (counts.suitCount[s] ?? 0) + 1;
    counts.suitRanks[s] = (counts.suitRanks[s] ?? 0) | (1 << card.rank);
  } else {
    counts.wilds++;
  }
}

export function countPool(pool: readonly Card[]): PoolCounts {
  const counts = emptyCounts();
  for (const card of pool) addCard(counts, card);
  return counts;
}

/** Number of ranks in h-4..h whose bit is NOT set in `mask`. */
function missingInWindow(mask: number, h: number): number {
  let missing = 0;
  for (let r = h - 4; r <= h; r++) {
    if ((mask & (1 << r)) === 0) missing++;
  }
  return missing;
}

/** Bitmask of all ranks with at least one natural in the pool. */
function anySuitMask(counts: PoolCounts): number {
  return (
    (counts.suitRanks[0] ?? 0) | (counts.suitRanks[1] ?? 0) | (counts.suitRanks[2] ?? 0) | (counts.suitRanks[3] ?? 0)
  );
}

/** How many naturals the bid is missing, before wilds are applied. */
export function missingNaturals(bid: Bid, counts: PoolCounts): number {
  const rc = counts.rankCount;
  switch (bid.category) {
    case "high":
      return Math.max(0, 1 - (rc[bid.rank] ?? 0));
    case "pair":
      return Math.max(0, 2 - (rc[bid.rank] ?? 0));
    case "trips":
      return Math.max(0, 3 - (rc[bid.rank] ?? 0));
    case "quads":
      return Math.max(0, 4 - (rc[bid.rank] ?? 0));
    case "fiveOfAKind":
      return Math.max(0, 5 - (rc[bid.rank] ?? 0));
    case "twoPair":
      return Math.max(0, 2 - (rc[bid.rank] ?? 0)) + Math.max(0, 2 - (rc[bid.rank2] ?? 0));
    case "fullHouse":
      return Math.max(0, 3 - (rc[bid.rank] ?? 0)) + Math.max(0, 2 - (rc[bid.rank2] ?? 0));
    case "straight":
      return missingInWindow(anySuitMask(counts), bid.rank);
    case "flush":
      return Math.max(0, 5 - (counts.suitCount[SUIT_INDEX[bid.suit]] ?? 0));
    case "straightFlush":
      return missingInWindow(counts.suitRanks[SUIT_INDEX[bid.suit]] ?? 0, bid.rank);
  }
}

/** `exists` on a pre-computed summary. */
export function existsInCounts(bid: Bid, counts: PoolCounts): boolean {
  return missingNaturals(bid, counts) <= counts.wilds;
}

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

export function exists(bid: Bid, pool: readonly Card[]): boolean {
  return existsInCounts(bid, countPool(pool));
}

type Natural = Extract<Card, { kind: "natural" }>;

function naturals(pool: readonly Card[]): Natural[] {
  return pool.filter((c): c is Natural => c.kind === "natural");
}

/** Up to `n` naturals of rank r, in pool order. */
function takeRank(nats: readonly Natural[], rank: Rank, n: number): Natural[] {
  return nats.filter((c) => c.rank === rank).slice(0, n);
}

/** One natural per rank in h-4..h (optionally restricted to a suit), ascending; and the ranks missing. */
function takeWindow(
  nats: readonly Natural[],
  h: Rank,
  suit: Suit | null,
): { readonly cards: Natural[]; readonly missing: Rank[] } {
  const cards: Natural[] = [];
  const missing: Rank[] = [];
  for (let r = h - 4; r <= h; r++) {
    const rank = r as Rank;
    const hit = nats.find((c) => c.rank === rank && (suit === null || c.suit === suit));
    if (hit) cards.push(hit);
    else missing.push(rank);
  }
  return { cards, missing };
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five"] as const;

function countPhrase(n: number, rank: Rank): string {
  const word = COUNT_WORDS[n] ?? String(n);
  return n === 1 ? `${word} ${rankLabel(rank)}` : `${word} ${rankLabel(rank)}s`;
}

function listRanks(ranks: readonly Rank[]): string {
  return ranks.map(rankLabel).join(", ");
}

function listCards(cards: readonly Natural[]): string {
  return cards.map((c) => `${rankLabel(c.rank)}${suitSymbol(c.suit)}`).join(", ");
}

/**
 * Same answer as `exists`, plus the witness cards for the reveal screen.
 * `cards` = the naturals that count toward the hand (in a sensible order) followed by
 * the wilds consumed. When the bid fails, `cards` are the best partial contributors
 * plus every wild (they would all be used), and `shortBy` = missing − W.
 */
export function explain(bid: Bid, pool: readonly Card[]): Explanation {
  const nats = naturals(pool);
  const wilds = pool.filter(isWild);
  const W = wilds.length;

  let found: Natural[];
  let need: number;
  let phrase: string;

  switch (bid.category) {
    case "high":
    case "pair":
    case "trips":
    case "quads":
    case "fiveOfAKind": {
      need = { high: 1, pair: 2, trips: 3, quads: 4, fiveOfAKind: 5 }[bid.category];
      found = takeRank(nats, bid.rank, need);
      phrase = countPhrase(found.length, bid.rank);
      break;
    }
    case "twoPair":
    case "fullHouse": {
      const needA = bid.category === "fullHouse" ? 3 : 2;
      const a = takeRank(nats, bid.rank, needA);
      const b = takeRank(nats, bid.rank2, 2);
      need = needA + 2;
      found = [...a, ...b];
      phrase = `${countPhrase(a.length, bid.rank)} and ${countPhrase(b.length, bid.rank2).toLowerCase()}`;
      break;
    }
    case "straight": {
      const w = takeWindow(nats, bid.rank, null);
      need = 5;
      found = w.cards;
      const ranks = w.cards.map((c) => c.rank);
      phrase =
        w.missing.length === 0
          ? `${listRanks(ranks)} all present`
          : w.cards.length === 0
            ? `none of ${listRanks(w.missing)}`
            : `${listRanks(ranks)} present, missing ${listRanks(w.missing)}`;
      break;
    }
    case "flush": {
      need = 5;
      found = nats.filter((c) => c.suit === bid.suit).slice(0, 5);
      const word = COUNT_WORDS[found.length] ?? String(found.length);
      phrase = `${word} ${suitSymbol(bid.suit)}`;
      break;
    }
    case "straightFlush": {
      const w = takeWindow(nats, bid.rank, bid.suit);
      need = 5;
      found = w.cards;
      const sym = suitSymbol(bid.suit);
      const missingLabels = w.missing.map((r) => `${rankLabel(r)}${sym}`).join(", ");
      phrase =
        w.missing.length === 0
          ? `${listCards(w.cards)} all present`
          : w.cards.length === 0
            ? `none of ${missingLabels}`
            : `${listCards(w.cards)} present, missing ${missingLabels}`;
      break;
    }
  }

  const missing = need - found.length;
  const ok = missing <= W;
  const wildsUsed = Math.min(missing, W);
  const shortBy = Math.max(0, missing - W);
  const wildWord = (n: number) => `${n} wild${n === 1 ? "" : "s"}`;

  const summary = ok
    ? wildsUsed > 0
      ? `${phrase} + ${wildWord(wildsUsed)}`
      : phrase
    : `Only ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)} ${W > 0 ? `+ ${wildWord(W)}` : "and no wilds"}: short by ${shortBy}`;

  return {
    exists: ok,
    cards: [...found, ...wilds.slice(0, wildsUsed)],
    wildsUsed,
    wildsAvailable: W,
    shortBy,
    summary,
  };
}

