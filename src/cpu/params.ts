/**
 * Tunable parameters per difficulty. Every number the bots use lives here so the
 * levels can be tuned by simulation (see strength.test.ts) without touching the policy.
 */
import type { Difficulty } from "./types";

export interface CpuParams {
  /** Call BS when P(current bid exists) is below this. */
  readonly callBelow: number;
  /** A raise is "believable" when P(it exists) is at least this. */
  readonly bidAtLeast: number;
  /** Probability of deliberately bidding something it does not believe. */
  readonly bluffRate: number;
  /** A bluff must still look plausible: P(it exists) is at least this. */
  readonly bluffFloor: number;
  /** How many categories above the cheapest believable one a bluff may reach. */
  readonly bluffReach: number;
  /**
   * Bluffs are chosen at random among the top fraction of plausible bluffs ranked by
   * P(exists). 1 = any plausible bluff; small = only the ones that lean on held cards.
   */
  readonly bluffTopFraction: number;
  /**
   * When raising honestly, the bot picks at random among believable bids in the cheapest
   * believable category whose P is within this margin of the best one (ties → variety;
   * with a hand-conditioned model the best ones are the ranks it holds).
   */
  readonly nearEqual: number;
  /** Probability of skipping the cheapest believable category for the next believable one. */
  readonly jumpRate: number;
  /** Std-dev of the noise added to probability estimates (easy's "mistakes"). */
  readonly noiseSd: number;
  /** Monte Carlo trials per decision (ignored by easy, which uses the static table). */
  readonly trials: number;
  /**
   * Hard only: for each earlier bid by another player, the probability that one natural
   * card matching that bid is forced into the unseen part of the sampled pool.
   */
  readonly evidenceWeight: number;
}

/**
 * Tuned by simulation (strength.test.ts, 2026-10-14): heads-up hard beats easy ~94%,
 * medium beats easy ~94%, hard beats medium ~70%; 4-player rounds average ~5 bids.
 */
export const CPU_PARAMS: Readonly<Record<Difficulty, CpuParams>> = {
  easy: {
    callBelow: 0.3,
    bidAtLeast: 0.55,
    bluffRate: 0.2,
    bluffFloor: 0.1,
    bluffReach: 2,
    bluffTopFraction: 1,
    nearEqual: 0.05,
    jumpRate: 0.25,
    noiseSd: 0.12,
    trials: 0,
    evidenceWeight: 0,
  },
  medium: {
    callBelow: 0.4,
    bidAtLeast: 0.6,
    bluffRate: 0.12,
    bluffFloor: 0.15,
    bluffReach: 2,
    bluffTopFraction: 0.5,
    nearEqual: 0.05,
    jumpRate: 0.2,
    noiseSd: 0,
    trials: 800,
    evidenceWeight: 0,
  },
  hard: {
    callBelow: 0.45,
    bidAtLeast: 0.65,
    bluffRate: 0.07,
    bluffFloor: 0.25,
    bluffReach: 1,
    bluffTopFraction: 0.2,
    nearEqual: 0.03,
    jumpRate: 0.3,
    noiseSd: 0,
    trials: 800,
    evidenceWeight: 0.35,
  },
};
