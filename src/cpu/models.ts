/**
 * A belief model answers "how likely is it that this bid exists?" for one decision.
 * The three levels differ only in the model; the policy (decide.ts) is shared.
 */
import { CATEGORIES, type Bid, type Category, type Rng } from "../engine/types";
import { bidKey } from "../engine/bids";
import { estimateExists } from "../engine/odds";
import { evidenceFromBids } from "./evidence";
import type { CpuParams } from "./params";
import { fractionExists, samplePools, type Prior } from "./sampler";
import { tableProbability } from "./table";
import type { CpuContext } from "./types";

export interface BeliefModel {
  /** Estimated P(bid exists) in [0, 1]. Stable for the same bid within one decision. */
  readonly p: (bid: Bid) => number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Approximate standard normal via the sum of three uniforms (good enough for noise). */
function gaussian(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) * 2;
}

/**
 * Easy: the static table, ignoring its hand, plus one noisy offset per category so it
 * sometimes misjudges a whole rung (calls a good bid, believes a bad one).
 */
export function easyModel(ctx: CpuContext, params: CpuParams): BeliefModel {
  const noise = new Map<Category, number>();
  for (const category of CATEGORIES) noise.set(category, params.noiseSd > 0 ? gaussian(ctx.rng) * params.noiseSd : 0);
  return {
    p: (bid) => {
      const base = tableProbability(bid.category, ctx.poolSize);
      // Certainties stay certain: even easy does not call BS on a bid that cannot be false.
      if (base <= 0 || base >= 1) return base;
      return clamp01(base + (noise.get(bid.category) ?? 0));
    },
  };
}

/**
 * Monte Carlo model conditioned on the bot's own hand. The current bid, which the call
 * decision hinges on, goes through the engine's `estimateExists` (exact at the extremes);
 * candidate raises share one sample set, so scoring 300 bids costs about one estimate.
 */
function sampledModel(ctx: CpuContext, params: CpuParams, priors: readonly Prior[]): BeliefModel {
  const cache = new Map<string, number>();
  const current = ctx.bids[ctx.bids.length - 1]?.bid ?? null;
  const trials = Math.max(1, params.trials);
  let samples: ReturnType<typeof samplePools> | null = null;
  return {
    p: (bid) => {
      const key = bidKey(bid);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let value: number;
      if (current !== null && priors.length === 0 && key === bidKey(current)) {
        value = estimateExists(bid, { known: ctx.hand, poolSize: ctx.poolSize, trials, rng: ctx.rng });
      } else {
        if (samples === null) {
          samples = samplePools({ known: ctx.hand, poolSize: ctx.poolSize, trials, rng: ctx.rng, priors });
        }
        value = fractionExists(bid, samples);
      }
      cache.set(key, value);
      return value;
    },
  };
}

/** Medium: conditions on its own hand only. */
export function mediumModel(ctx: CpuContext, params: CpuParams): BeliefModel {
  return sampledModel(ctx, params, []);
}

/** Hard: own hand plus earlier bids by other players as weak evidence (see evidence.ts). */
export function hardModel(ctx: CpuContext, params: CpuParams): BeliefModel {
  return sampledModel(ctx, params, evidenceFromBids(ctx.bids, ctx.me, params.evidenceWeight));
}
