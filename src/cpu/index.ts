/**
 * CPU players (SPEC "Engine → CPU").
 *
 *   easy    static table of P(bid exists | pool size, category); ignores its hand; noisy.
 *   medium  Monte Carlo conditioned on its own hand.
 *   hard    also treats earlier bids by other players as weak evidence about their hands,
 *           calls BS more sharply and bluffs less (and on ranks it holds).
 *
 * `cpuDecide` is a pure function of the context: the only randomness is `ctx.rng`.
 */
import { decide } from "./decide";
import { easyModel, hardModel, mediumModel, type BeliefModel } from "./models";
import { CPU_PARAMS, type CpuParams } from "./params";
import type { CpuContext, CpuDecision, Difficulty } from "./types";

export * from "./types";
export { CPU_PARAMS, type CpuParams } from "./params";
export { tableProbability } from "./table";

const MODELS: Readonly<Record<Difficulty, (ctx: CpuContext, params: CpuParams) => BeliefModel>> = {
  easy: easyModel,
  medium: mediumModel,
  hard: hardModel,
};

/** Decide with an explicit parameter set (used by the tuning simulations). */
export function cpuDecideWith(ctx: CpuContext, difficulty: Difficulty, params: CpuParams): CpuDecision {
  return decide(ctx, params, MODELS[difficulty](ctx, params));
}

export function cpuDecide(ctx: CpuContext, difficulty: Difficulty): CpuDecision {
  return cpuDecideWith(ctx, difficulty, CPU_PARAMS[difficulty]);
}
