/**
 * CPU player contract (SPEC "Engine → CPU").
 * The CPU is a pure function of the game state it can legitimately see:
 * its own hand, the pool size, the bid history, and the legal raises.
 */
import type { Action, Bid, BidRecord, Card, GameConfig, Rng } from "../engine/types";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export interface CpuContext {
  /** This bot's seat index. */
  readonly me: number;
  readonly hand: readonly Card[];
  /** Total cards in play this round (all hands). */
  readonly poolSize: number;
  /** Per-player card counts this round (index = seat; 0 when eliminated). */
  readonly cardCounts: readonly number[];
  /** Bids so far this round, oldest first. Empty when opening. */
  readonly bids: readonly BidRecord[];
  /** Bids strictly above the current bid (or every bid when opening). */
  readonly legalBids: readonly Bid[];
  readonly config: GameConfig;
  readonly rng: Rng;
}

export interface CpuDecision {
  readonly action: Action;
  /** Estimated P(current bid exists), 0..1; null when opening (nothing to call). */
  readonly pCurrentExists: number | null;
  /** Estimated P(the bid we are making exists); null when calling BS. */
  readonly pMyBidExists: number | null;
  /** True when the bot knowingly bid something it believes is unlikely. */
  readonly bluffing: boolean;
}

export type CpuDecide = (ctx: CpuContext, difficulty: Difficulty) => CpuDecision;
