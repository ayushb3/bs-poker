/**
 * The shared bidding policy (SPEC "Engine → CPU"): call BS when the current bid looks
 * too unlikely, otherwise raise to the cheapest bid the bot believes, with a bluff rate
 * set by the difficulty. The three levels plug in different belief models (models.ts)
 * and parameter sets (params.ts); the policy itself is the same.
 */
import { CATEGORIES, type Action, type Bid, type Category } from "../engine/types";
import type { BeliefModel } from "./models";
import type { CpuParams } from "./params";
import type { CpuContext, CpuDecision } from "./types";

interface Scored {
  readonly bid: Bid;
  readonly p: number;
}

/** Legal bids grouped by category, in ladder order (empty categories omitted). */
function groupByCategory(bids: readonly Bid[]): Bid[][] {
  const groups = new Map<Category, Bid[]>();
  for (const bid of bids) {
    const list = groups.get(bid.category);
    if (list) list.push(bid);
    else groups.set(bid.category, [bid]);
  }
  return CATEGORIES.map((c) => groups.get(c) ?? []).filter((g) => g.length > 0);
}

function pickRandom<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Highest p; ties broken by ladder order (items are already ascending). */
function best(items: readonly Scored[]): Scored {
  let top = items[0] as Scored;
  for (const s of items) if (s.p > top.p) top = s;
  return top;
}

export function decide(ctx: CpuContext, params: CpuParams, model: BeliefModel): CpuDecision {
  const current = ctx.bids[ctx.bids.length - 1]?.bid ?? null;
  const pCurrent = current === null ? null : model.p(current);
  const callBS = (): CpuDecision => ({
    action: { type: "callBS" },
    pCurrentExists: pCurrent ?? 0,
    pMyBidExists: null,
    bluffing: false,
  });
  const raise = (choice: Scored, bluffing: boolean): CpuDecision => {
    const action: Action = { type: "bid", bid: choice.bid };
    return { action, pCurrentExists: pCurrent, pMyBidExists: choice.p, bluffing };
  };

  // Nothing above the current bid: the only legal move is to call.
  if (ctx.legalBids.length === 0) return callBS();

  // 1. Call when the current bid looks too weak (never when opening).
  if (pCurrent !== null && pCurrent < params.callBelow) return callBS();

  // 2. Score raises one category at a time, cheapest first, until a believable one shows up.
  const groups = groupByCategory(ctx.legalBids);
  const scored: Scored[][] = [];
  const scoreGroup = (gi: number): Scored[] => {
    let s = scored[gi];
    if (s === undefined) {
      s = (groups[gi] ?? []).map((bid) => ({ bid, p: model.p(bid) }));
      scored[gi] = s;
    }
    return s;
  };
  const believable = (gi: number): Scored[] => scoreGroup(gi).filter((s) => s.p >= params.bidAtLeast);

  let firstBelievable = -1;
  for (let gi = 0; gi < groups.length; gi++) {
    if (believable(gi).length > 0) {
      firstBelievable = gi;
      break;
    }
  }

  // 3. Bluff: a bid it does not believe but which still looks plausible, at most a
  //    couple of categories above the cheapest believable rung (never an absurd jump).
  if (ctx.rng() < params.bluffRate) {
    const from = Math.max(0, firstBelievable);
    const pool: Scored[] = [];
    for (let gi = from; gi < groups.length && gi <= from + params.bluffReach; gi++) {
      for (const s of scoreGroup(gi)) if (s.p < params.bidAtLeast && s.p >= params.bluffFloor) pool.push(s);
    }
    if (pool.length > 0) {
      const ranked = [...pool].sort((a, b) => b.p - a.p);
      const top = ranked.slice(0, Math.max(1, Math.round(ranked.length * params.bluffTopFraction)));
      return raise(pickRandom(top, ctx.rng), true);
    }
  }

  // 4. Honest raise: cheapest believable category (sometimes the next one up, for pace
  //    and variety), and within it one of the strongest bids, which with a
  //    hand-conditioned model means the ranks it holds (SPEC §3).
  if (firstBelievable >= 0) {
    let gi = firstBelievable;
    if (ctx.rng() < params.jumpRate) {
      for (let next = gi + 1; next < groups.length && next <= gi + 2; next++) {
        if (believable(next).length > 0) {
          gi = next;
          break;
        }
      }
    }
    const candidates = believable(gi);
    const top = best(candidates).p;
    const near = candidates.filter((s) => s.p >= top - params.nearEqual);
    return raise(pickRandom(near, ctx.rng), false);
  }

  // 5. Nothing believable. Opening: must bid, take the most likely one. Otherwise pick the
  //    lesser evil: calling wins with 1 - P(current), a desperation bluff survives a call
  //    with P(best raise).
  const all: Scored[] = [];
  for (let gi = 0; gi < groups.length; gi++) all.push(...scoreGroup(gi));
  const fallback = best(all);
  if (pCurrent !== null && 1 - pCurrent >= fallback.p) return callBS();
  return raise(fallback, fallback.p < params.bidAtLeast);
}
