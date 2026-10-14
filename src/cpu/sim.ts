/**
 * Bot-only simulation harness on top of the engine's game loop. Used by the strength and
 * pacing tests (and `npm run sim`) to tune the parameters in params.ts.
 */
import { applyAction, legalActions, newGame, nextRound } from "../engine/game";
import type { GameConfig, GameState, Rng } from "../engine/types";
import { cpuDecideWith } from "./index";
import { CPU_PARAMS, type CpuParams } from "./params";
import type { CpuContext, Difficulty } from "./types";

export interface Seat {
  readonly difficulty: Difficulty;
  readonly params?: CpuParams;
}

export interface GameSummary {
  readonly winner: number;
  readonly rounds: number;
  /** Bids made before BS was called, per round. */
  readonly bidsPerRound: readonly number[];
}

/** The context a seated bot may legitimately see. */
export function contextFor(state: GameState, rng: Rng): CpuContext {
  const me = state.turn;
  const player = state.players[me];
  if (player === undefined) throw new Error("bad turn");
  return {
    me,
    hand: player.hand,
    poolSize: state.players.reduce((n, p) => n + p.hand.length, 0),
    cardCounts: state.players.map((p) => (p.eliminated ? 0 : p.cardCount)),
    bids: state.bids,
    legalBids: legalActions(state).bids,
    config: state.config,
    rng,
  };
}

export function playGame(seats: readonly Seat[], rng: Rng, config: Partial<GameConfig> = {}): GameSummary {
  let state = newGame({ playerCount: seats.length, ...config }, rng);
  const bidsPerRound: number[] = [];
  let guard = 0;
  while (state.phase !== "over") {
    if (state.phase === "reveal") {
      state = nextRound(state, rng);
      continue;
    }
    const seat = seats[state.turn];
    if (seat === undefined) throw new Error("bad seat");
    const decision = cpuDecideWith(contextFor(state, rng), seat.difficulty, seat.params ?? CPU_PARAMS[seat.difficulty]);
    if (decision.action.type === "callBS") bidsPerRound.push(state.bids.length);
    state = applyAction(state, decision.action);
    if (++guard > 100_000) throw new Error("runaway game");
  }
  if (state.winner === null) throw new Error("game over without a winner");
  return { winner: state.winner, rounds: state.round, bidsPerRound };
}

export interface MatchResult {
  /** Wins per seat index. */
  readonly wins: number[];
  readonly games: number;
  readonly avgBidsPerRound: number;
  readonly avgRounds: number;
}

/** Plays `games` games, rotating the seat order each game so position is not a factor. */
export function runMatch(seats: readonly Seat[], games: number, rng: Rng, config: Partial<GameConfig> = {}): MatchResult {
  const wins = seats.map(() => 0);
  let bids = 0;
  let roundsTotal = 0;
  for (let g = 0; g < games; g++) {
    const shift = g % seats.length;
    const rotated = seats.map((_, i) => seats[(i + shift) % seats.length] as Seat);
    const result = playGame(rotated, rng, config);
    wins[(result.winner + shift) % seats.length] = (wins[(result.winner + shift) % seats.length] ?? 0) + 1;
    bids += result.bidsPerRound.reduce((a, b) => a + b, 0);
    roundsTotal += result.bidsPerRound.length;
  }
  return { wins, games, avgBidsPerRound: bids / Math.max(1, roundsTotal), avgRounds: roundsTotal / games };
}
