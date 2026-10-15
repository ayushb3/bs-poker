/** Helpers shared by the CPU tests (not part of the CPU API). */
import { makeDeck, shuffle } from "../engine/deck";
import { allBids, legalRaises } from "../engine/bids";
import { DEFAULT_CONFIG, type Bid, type BidRecord, type Card, type Rng } from "../engine/types";
import type { CpuContext } from "./types";

const BY_ID = new Map(makeDeck().map((c) => [c.id, c]));
export const cards = (...ids: string[]): Card[] => ids.map((id) => BY_ID.get(id) as Card);

export interface ContextOverrides {
  readonly hand?: readonly Card[];
  readonly poolSize?: number;
  readonly bids?: readonly BidRecord[];
  readonly me?: number;
  readonly rng?: Rng;
}

/** A 4-player context; legalBids follows from the last bid. */
export function makeContext(o: ContextOverrides): CpuContext {
  const bids = o.bids ?? [];
  const current = bids[bids.length - 1]?.bid ?? null;
  const hand = o.hand ?? [];
  const poolSize = o.poolSize ?? Math.max(8, hand.length);
  const perSeat = Math.max(1, Math.floor(poolSize / 4));
  return {
    me: o.me ?? 0,
    hand,
    poolSize,
    cardCounts: [hand.length || perSeat, perSeat, perSeat, poolSize - (hand.length || perSeat) - 2 * perSeat],
    bids,
    legalBids: legalRaises(current),
    config: DEFAULT_CONFIG,
    rng: o.rng ?? (() => 0.5),
  };
}

/**
 * A random but internally consistent context: pool 4..30, a hand of 1..7 cards, and a
 * strictly ascending bid history of 0..6 bids by other seats (sometimes reaching the top
 * of the ladder so that legalBids is empty).
 */
export function randomContext(rng: Rng): CpuContext {
  const poolSize = 4 + Math.floor(rng() * 27);
  const handSize = 1 + Math.floor(rng() * Math.min(7, poolSize - 1));
  const deck = shuffle(makeDeck(), rng);
  const hand = deck.slice(0, handSize);
  const ladder = allBids();
  const count = Math.floor(rng() * 7);
  const bids: BidRecord[] = [];
  let from = 0;
  for (let i = 0; i < count; i++) {
    // Occasionally jump to the very top so the next player has nothing left to bid.
    const idx = rng() < 0.05 ? ladder.length - 1 : from + Math.floor(rng() * Math.min(40, ladder.length - from));
    if (idx >= ladder.length) break;
    bids.push({ player: 1 + (i % 3), bid: ladder[idx] as Bid });
    from = idx + 1;
    if (from >= ladder.length) break;
  }
  return makeContext({ hand, poolSize, bids, rng });
}
