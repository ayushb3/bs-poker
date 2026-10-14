/**
 * Bids and the ladder. `compare` is the single owner of the bid order;
 * everything else (allBids, legalRaises, equality) is derived from it.
 */
import { rankLabel, suitSymbol } from "./deck";
import { CATEGORIES, RANKS, SUITS, type Bid, type Category, type Rank, type Suit } from "./types";

export { rankLabel, suitSymbol };

const CATEGORY_INDEX: Readonly<Record<Category, number>> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
) as Record<Category, number>;

const SUIT_INDEX: Readonly<Record<Suit, number>> = { c: 0, d: 1, h: 2, s: 3 };

/** Straights and straight flushes run from 3-4-5-6-7 (h=7) up to 10-J-Q-K-A (h=14). */
export const STRAIGHT_HIGHS: readonly Rank[] = [7, 8, 9, 10, 11, 12, 13, 14];

/** Sort key within a category: (primary, secondary). */
function withinKey(bid: Bid): readonly [number, number] {
  switch (bid.category) {
    case "high":
    case "pair":
    case "straight":
    case "trips":
    case "quads":
    case "fiveOfAKind":
      return [bid.rank, 0];
    case "twoPair":
    case "fullHouse":
      return [bid.rank, bid.rank2];
    case "flush":
      return [SUIT_INDEX[bid.suit], 0];
    case "straightFlush":
      return [bid.rank, SUIT_INDEX[bid.suit]];
  }
}

/**
 * The ladder: high < pair < straight < trips < twoPair < flush < fullHouse < quads
 * < straightFlush < fiveOfAKind. Within a category: rank, then rank2; flush by suit
 * (c < d < h < s); straightFlush by rank, then suit. Negative when a < b, 0 when equal.
 */
export function compare(a: Bid, b: Bid): number {
  const dc = CATEGORY_INDEX[a.category] - CATEGORY_INDEX[b.category];
  if (dc !== 0) return dc;
  const [a1, a2] = withinKey(a);
  const [b1, b2] = withinKey(b);
  if (a1 !== b1) return a1 - b1;
  return a2 - b2;
}

export function bidsEqual(a: Bid, b: Bid): boolean {
  return compare(a, b) === 0;
}

function generateBids(): Bid[] {
  const out: Bid[] = [];
  for (const category of ["high", "pair", "trips", "quads", "fiveOfAKind"] as const) {
    for (const rank of RANKS) out.push({ category, rank });
  }
  for (const rank of STRAIGHT_HIGHS) out.push({ category: "straight", rank });
  for (const rank of RANKS) {
    for (const rank2 of RANKS) {
      if (rank > rank2) out.push({ category: "twoPair", rank, rank2 });
    }
  }
  for (const suit of SUITS) out.push({ category: "flush", suit });
  for (const rank of RANKS) {
    for (const rank2 of RANKS) {
      if (rank !== rank2) out.push({ category: "fullHouse", rank, rank2 });
    }
  }
  for (const rank of STRAIGHT_HIGHS) {
    for (const suit of SUITS) out.push({ category: "straightFlush", rank, suit });
  }
  out.sort(compare);
  // Deduplicate (defensive; the generator above never produces duplicates).
  const deduped: Bid[] = [];
  for (const bid of out) {
    const last = deduped[deduped.length - 1];
    if (last === undefined || compare(last, bid) !== 0) deduped.push(bid);
  }
  return deduped;
}

const ALL_BIDS: readonly Bid[] = Object.freeze(generateBids().map((b) => Object.freeze(b)));
const ALL_BID_KEYS: ReadonlySet<string> = new Set(ALL_BIDS.map(bidKey));

/** Every legal bid (302 of them), strictly ascending under `compare`. */
export function allBids(): readonly Bid[] {
  return ALL_BIDS;
}

/** True when `bid` is one of `allBids()` (well-formed and in range). */
export function isLegalBid(bid: Bid): boolean {
  return ALL_BID_KEYS.has(bidKey(bid));
}

/** Bids strictly above `current`; all bids when `current` is null. */
export function legalRaises(current: Bid | null): readonly Bid[] {
  if (current === null) return ALL_BIDS;
  return ALL_BIDS.filter((b) => compare(b, current) > 0);
}

/** Stable string id, e.g. `"pair:7"`, `"fullHouse:13:4"`, `"flush:h"`, `"straightFlush:9:s"`. */
export function bidKey(bid: Bid): string {
  switch (bid.category) {
    case "high":
    case "pair":
    case "straight":
    case "trips":
    case "quads":
    case "fiveOfAKind":
      return `${bid.category}:${bid.rank}`;
    case "twoPair":
    case "fullHouse":
      return `${bid.category}:${bid.rank}:${bid.rank2}`;
    case "flush":
      return `flush:${bid.suit}`;
    case "straightFlush":
      return `straightFlush:${bid.rank}:${bid.suit}`;
  }
}

function parseRank(text: string | undefined, key: string): Rank {
  if (text === undefined || !/^\d{1,2}$/.test(text)) throw new Error(`Bad bid key: ${key}`);
  const n = Number(text);
  if (!(RANKS as readonly number[]).includes(n)) throw new Error(`Bad bid key: ${key}`);
  return n as Rank;
}

function parseSuit(text: string | undefined, key: string): Suit {
  if (text !== "c" && text !== "d" && text !== "h" && text !== "s") {
    throw new Error(`Bad bid key: ${key}`);
  }
  return text;
}

/** Inverse of `bidKey`. Throws on malformed or out-of-range keys. */
export function parseBidKey(key: string): Bid {
  const parts = key.split(":");
  const category = parts[0];
  const argc = parts.length - 1;
  let bid: Bid;
  switch (category) {
    case "high":
    case "pair":
    case "trips":
    case "quads":
    case "fiveOfAKind":
    case "straight":
      if (argc !== 1) throw new Error(`Bad bid key: ${key}`);
      bid = { category, rank: parseRank(parts[1], key) };
      break;
    case "twoPair":
    case "fullHouse":
      if (argc !== 2) throw new Error(`Bad bid key: ${key}`);
      bid = { category, rank: parseRank(parts[1], key), rank2: parseRank(parts[2], key) };
      break;
    case "flush":
      if (argc !== 1) throw new Error(`Bad bid key: ${key}`);
      bid = { category, suit: parseSuit(parts[1], key) };
      break;
    case "straightFlush":
      if (argc !== 2) throw new Error(`Bad bid key: ${key}`);
      bid = { category, rank: parseRank(parts[1], key), suit: parseSuit(parts[2], key) };
      break;
    default:
      throw new Error(`Bad bid key: ${key}`);
  }
  if (!isLegalBid(bid)) throw new Error(`Bad bid key: ${key}`);
  return bid;
}

/** Plural rank label: "7s", "10s", "As". */
function plural(rank: Rank): string {
  return `${rankLabel(rank)}s`;
}

/**
 * Human label: "High card A", "Pair of 7s", "Straight to J", "Three of a kind, 9s",
 * "Two pair, As over 9s", "Flush in ♥", "Full house, Ks over 4s", "Four of a kind, 9s",
 * "Straight flush to 9 in ♠", "Five of a kind, Qs".
 */
export function bidLabel(bid: Bid): string {
  switch (bid.category) {
    case "high":
      return `High card ${rankLabel(bid.rank)}`;
    case "pair":
      return `Pair of ${plural(bid.rank)}`;
    case "straight":
      return `Straight to ${rankLabel(bid.rank)}`;
    case "trips":
      return `Three of a kind, ${plural(bid.rank)}`;
    case "twoPair":
      return `Two pair, ${plural(bid.rank)} over ${plural(bid.rank2)}`;
    case "flush":
      return `Flush in ${suitSymbol(bid.suit)}`;
    case "fullHouse":
      return `Full house, ${plural(bid.rank)} over ${plural(bid.rank2)}`;
    case "quads":
      return `Four of a kind, ${plural(bid.rank)}`;
    case "straightFlush":
      return `Straight flush to ${rankLabel(bid.rank)} in ${suitSymbol(bid.suit)}`;
    case "fiveOfAKind":
      return `Five of a kind, ${plural(bid.rank)}`;
  }
}
