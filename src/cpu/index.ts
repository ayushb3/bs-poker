/**
 * PLACEHOLDER CPU — replaced in M1 by the real easy/medium/hard bots.
 * Calls BS 30% of the time (never when opening), otherwise takes the lowest legal raise.
 */
import type { CpuContext, CpuDecision, Difficulty } from "./types";

export * from "./types";

export function cpuDecide(ctx: CpuContext, _difficulty: Difficulty): CpuDecision {
  const canCall = ctx.bids.length > 0;
  if (canCall && ctx.rng() < 0.3) {
    return { action: { type: "callBS" }, pCurrentExists: 0.5, pMyBidExists: null, bluffing: false };
  }
  const bid = ctx.legalBids[0];
  if (!bid) {
    return { action: { type: "callBS" }, pCurrentExists: 0.5, pMyBidExists: null, bluffing: false };
  }
  return { action: { type: "bid", bid }, pCurrentExists: canCall ? 0.5 : null, pMyBidExists: 0.5, bluffing: false };
}
