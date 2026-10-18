/**
 * One bot turn, shared by the single-player controller and the multiplayer
 * host: build what the bot may see, ask the CPU, and never return an illegal
 * action. Pure apart from `rng`.
 */
import type { Action, GameState, Rng } from "../engine";
import { legalActions, poolOf } from "../engine";
import type { CpuContext, Difficulty } from "../cpu";
import { cpuDecide } from "../cpu";

/** What the bot in `seat` can legitimately see: its own hand, counts, bids and legal raises. */
export function cpuContextFor(game: GameState, seat: number, rng: Rng): CpuContext | null {
  const me = game.players[seat];
  if (!me) return null;
  return {
    me: seat,
    hand: me.hand,
    poolSize: poolOf(game).length,
    cardCounts: game.players.map((p) => (p.eliminated ? 0 : p.cardCount)),
    bids: game.bids,
    legalBids: legalActions(game).bids,
    config: game.config,
    rng,
  };
}

/** The bot's move for `seat`, or null when it is not that seat's turn to bid. */
export function botAction(game: GameState, seat: number, difficulty: Difficulty, rng: Rng): Action | null {
  if (game.phase !== "bidding" || game.turn !== seat) return null;
  const ctx = cpuContextFor(game, seat, rng);
  if (!ctx) return null;
  const action = cpuDecide(ctx, difficulty).action;
  // Defensive: never let a bot stall the table on an illegal action.
  const legal = legalActions(game);
  if (action.type === "callBS" && !legal.canCallBS) {
    const first = legal.bids[0];
    return first ? { type: "bid", bid: first } : null;
  }
  return action;
}
