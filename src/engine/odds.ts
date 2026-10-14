/**
 * Monte Carlo odds: P(bid exists) in a pool of `poolSize` cards, given that the
 * `known` cards are certainly in the pool and the rest are drawn uniformly without
 * replacement from the remaining deck.
 */
import { makeDeck } from "./deck";
import { addCard, countPool, existsInCounts, missingNaturals, type PoolCounts } from "./exists";
import { type Bid, type Card, type Rng } from "./types";

export interface EstimateOptions {
  readonly known?: readonly Card[];
  readonly poolSize: number;
  readonly trials?: number;
  readonly rng?: Rng;
}

const FULL_DECK: readonly Card[] = makeDeck();

/** Copy of a PoolCounts so each trial starts from the known cards. */
function cloneCounts(src: PoolCounts): PoolCounts {
  return {
    rankCount: new Uint8Array(src.rankCount),
    suitCount: new Uint8Array(src.suitCount),
    suitRanks: new Uint16Array(src.suitRanks),
    wilds: src.wilds,
  };
}

function copyInto(dst: PoolCounts, src: PoolCounts): void {
  dst.rankCount.set(src.rankCount);
  dst.suitCount.set(src.suitCount);
  dst.suitRanks.set(src.suitRanks);
  dst.wilds = src.wilds;
}

/**
 * Returns an estimate in [0, 1]. Exact (no sampling) when nothing is drawn, or when the
 * known cards already decide the answer (bid already satisfied → 1; bid impossible even
 * if every drawn card were a wild → 0).
 */
export function estimateExists(bid: Bid, opts: EstimateOptions): number {
  const known = opts.known ?? [];
  const trials = opts.trials ?? 2000;
  const rng = opts.rng ?? Math.random;
  if (!Number.isInteger(opts.poolSize) || opts.poolSize < 0) throw new Error("poolSize must be a non-negative integer");
  if (!Number.isInteger(trials) || trials < 1) throw new Error("trials must be a positive integer");

  const knownIds = new Set(known.map((c) => c.id));
  const remaining = FULL_DECK.filter((c) => !knownIds.has(c.id));
  const draws = opts.poolSize - known.length;
  if (draws < 0) throw new Error("poolSize is smaller than the number of known cards");
  if (draws > remaining.length) throw new Error("poolSize exceeds the deck");

  const base = countPool(known);
  // Shortcuts that make the answer exact.
  if (existsInCounts(bid, base)) return 1;
  if (missingNaturals(bid, base) > base.wilds + draws) return 0;
  if (draws === 0) return 0;

  const work = cloneCounts(base);
  const idx = remaining.map((_, i) => i);
  const n = idx.length;
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    copyInto(work, base);
    // Partial Fisher–Yates: the first `draws` entries of idx become a uniform sample.
    for (let i = 0; i < draws; i++) {
      const j = i + Math.floor(rng() * (n - i));
      const a = idx[i] as number;
      idx[i] = idx[j] as number;
      idx[j] = a;
      addCard(work, remaining[idx[i] as number] as Card);
    }
    if (existsInCounts(bid, work)) hits++;
  }
  return hits / trials;
}
