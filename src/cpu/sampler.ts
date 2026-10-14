/**
 * Monte Carlo pool sampler shared by medium and hard.
 *
 * Same model as the engine's `estimateExists`: the `known` cards (the bot's hand) are
 * certainly in the pool and the other `poolSize - known.length` cards are drawn uniformly
 * without replacement from the rest of the deck. The difference is that we keep every
 * sampled pool (as a `PoolCounts` summary) so one sample set can score the current bid
 * and every candidate raise, instead of re-sampling per bid.
 *
 * Hard adds `priors`: before the uniform draw, each prior independently (with its `prob`)
 * forces one random card from its `candidates` into the unseen part of the pool. That is a
 * mixture distribution that biases the sample toward hands consistent with earlier bids.
 */
import { makeDeck } from "../engine/deck";
import { addCard, countPool, existsInCounts, type PoolCounts } from "../engine/exists";
import type { Bid, Card, Rng } from "../engine/types";

export interface Prior {
  /** Cards one of which is believed to be in the pool. Known cards are ignored. */
  readonly candidates: readonly Card[];
  /** Probability that this prior is applied in a given sample. */
  readonly prob: number;
}

export interface SampleOptions {
  readonly known: readonly Card[];
  readonly poolSize: number;
  readonly trials: number;
  readonly rng: Rng;
  readonly priors?: readonly Prior[];
}

const FULL_DECK: readonly Card[] = makeDeck();

function cloneCounts(src: PoolCounts): PoolCounts {
  return {
    rankCount: new Uint8Array(src.rankCount),
    suitCount: new Uint8Array(src.suitCount),
    suitRanks: new Uint16Array(src.suitRanks),
    wilds: src.wilds,
  };
}

export function samplePools(opts: SampleOptions): PoolCounts[] {
  const { known, rng } = opts;
  const knownIds = new Set(known.map((c) => c.id));
  const remaining = FULL_DECK.filter((c) => !knownIds.has(c.id));
  const draws = Math.min(remaining.length, Math.max(0, opts.poolSize - known.length));
  const base = countPool(known);
  const n = remaining.length;

  // Priors as index lists into `remaining`.
  const indexOf = new Map(remaining.map((c, i) => [c.id, i]));
  const priors = (opts.priors ?? [])
    .map((p) => ({
      prob: p.prob,
      candidates: p.candidates.map((c) => indexOf.get(c.id)).filter((i): i is number => i !== undefined),
    }))
    .filter((p) => p.prob > 0 && p.candidates.length > 0);

  // idx is a permutation of 0..n-1; pos is its inverse so forced cards can be found.
  const idx = remaining.map((_, i) => i);
  const pos = remaining.map((_, i) => i);
  const swap = (a: number, b: number): void => {
    const ia = idx[a] as number;
    const ib = idx[b] as number;
    idx[a] = ib;
    idx[b] = ia;
    pos[ib] = a;
    pos[ia] = b;
  };

  const samples: PoolCounts[] = new Array(opts.trials);
  const eligible: number[] = [];
  for (let t = 0; t < opts.trials; t++) {
    const work = cloneCounts(base);
    let i = 0;
    for (const prior of priors) {
      if (i >= draws) break;
      if (rng() >= prior.prob) continue;
      eligible.length = 0;
      for (const c of prior.candidates) if ((pos[c] as number) >= i) eligible.push(c);
      if (eligible.length === 0) continue;
      const pick = eligible[Math.floor(rng() * eligible.length)] as number;
      swap(i, pos[pick] as number);
      addCard(work, remaining[idx[i] as number] as Card);
      i++;
    }
    for (; i < draws; i++) {
      swap(i, i + Math.floor(rng() * (n - i)));
      addCard(work, remaining[idx[i] as number] as Card);
    }
    samples[t] = work;
  }
  return samples;
}

/** Fraction of the samples in which `bid` exists. */
export function fractionExists(bid: Bid, samples: readonly PoolCounts[]): number {
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const s of samples) if (existsInCounts(bid, s)) hits++;
  return hits / samples.length;
}
