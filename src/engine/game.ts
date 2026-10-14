/**
 * Round loop. Every function here is pure: it returns a new GameState and never
 * mutates its input. Randomness comes only from the injected `Rng`.
 */
import { compare, isLegalBid, legalRaises } from "./bids";
import { makeDeck, shuffle } from "./deck";
import { explain } from "./exists";
import {
  DEFAULT_CONFIG,
  type Action,
  type Bid,
  type Card,
  type GameConfig,
  type GameState,
  type PlayerState,
  type Rng,
  type RoundResult,
} from "./types";

function isInt(n: number, lo: number, hi: number): boolean {
  return Number.isInteger(n) && n >= lo && n <= hi;
}

/** Fills in defaults and validates. Throws on an invalid config. */
export function resolveConfig(partial: Partial<GameConfig>): GameConfig {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...partial };
  if (!isInt(config.playerCount, 2, 6)) throw new Error("playerCount must be an integer in 2..6");
  if (!isInt(config.cardCap, 4, 8)) throw new Error("cardCap must be an integer in 4..8");
  // Spec reading: startingCards must leave room below the cap, otherwise everyone would be
  // eliminated after round 1 (and a player at the cap would never be dealt in).
  if (!isInt(config.startingCards, 1, config.cardCap - 1)) {
    throw new Error("startingCards must be an integer >= 1 and below cardCap");
  }
  return config;
}

export function activePlayers(state: GameState): number[] {
  return state.players.filter((p) => !p.eliminated).map((p) => p.id);
}

/** All hands concatenated, in seat order. */
export function poolOf(state: GameState): Card[] {
  return state.players.flatMap((p) => p.hand);
}

/** The next non-eliminated seat clockwise after `from` (may wrap; never `from` itself unless alone). */
function nextActiveAfter(players: readonly PlayerState[], from: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const id = (from + step) % n;
    const p = players[id];
    if (p !== undefined && !p.eliminated) return id;
  }
  throw new Error("no active players");
}

/** Deals `cardCount` cards to every active player from a fresh shuffle. */
function deal(players: readonly PlayerState[], rng: Rng): PlayerState[] {
  const deck = shuffle(makeDeck(), rng);
  let next = 0;
  return players.map((p) => {
    if (p.eliminated) return { ...p, hand: [] };
    const hand = deck.slice(next, next + p.cardCount);
    if (hand.length !== p.cardCount) throw new Error("deck exhausted while dealing");
    next += p.cardCount;
    return { ...p, hand };
  });
}

export function newGame(partial: Partial<GameConfig>, rng: Rng): GameState {
  const config = resolveConfig(partial);
  const bare: PlayerState[] = Array.from({ length: config.playerCount }, (_, id) => ({
    id,
    cardCount: config.startingCards,
    eliminated: false,
    hand: [],
  }));
  const players = deal(bare, rng);
  const starter = Math.floor(rng() * config.playerCount);
  return {
    config,
    players,
    round: 1,
    starter,
    turn: starter,
    bids: [],
    phase: "bidding",
    lastResult: null,
    winner: null,
  };
}

function currentBid(state: GameState): Bid | null {
  const last = state.bids[state.bids.length - 1];
  return last === undefined ? null : last.bid;
}

export function legalActions(state: GameState): { bids: readonly Bid[]; canCallBS: boolean } {
  if (state.phase !== "bidding") return { bids: [], canCallBS: false };
  return { bids: legalRaises(currentBid(state)), canCallBS: state.bids.length > 0 };
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase !== "bidding") throw new Error(`cannot act during phase "${state.phase}"`);
  switch (action.type) {
    case "bid":
      return applyBid(state, action.bid);
    case "callBS":
      return applyCallBS(state);
  }
}

function applyBid(state: GameState, bid: Bid): GameState {
  if (!isLegalBid(bid)) throw new Error("not a legal bid");
  const current = currentBid(state);
  if (current !== null && compare(bid, current) <= 0) throw new Error("bid must be strictly higher than the current bid");
  return {
    ...state,
    bids: [...state.bids, { player: state.turn, bid }],
    turn: nextActiveAfter(state.players, state.turn),
  };
}

function applyCallBS(state: GameState): GameState {
  const last = state.bids[state.bids.length - 1];
  if (last === undefined) throw new Error("cannot call BS before any bid");
  const pool = poolOf(state);
  const explanation = explain(last.bid, pool);
  const caller = state.turn;
  const bidder = last.player;
  const loser = explanation.exists ? caller : bidder;

  const eliminated: number[] = [];
  const players = state.players.map((p) => {
    if (p.id !== loser) return p;
    const cardCount = p.cardCount + 1;
    if (cardCount >= state.config.cardCap) {
      eliminated.push(p.id);
      // The hand stays visible during the reveal; nextRound() deals it away.
      return { ...p, cardCount, eliminated: true };
    }
    return { ...p, cardCount };
  });

  const lastResult: RoundResult = {
    round: state.round,
    bidder,
    caller,
    bid: last.bid,
    existed: explanation.exists,
    loser,
    explanation,
    pool,
    eliminated,
  };

  const active = players.filter((p) => !p.eliminated);
  const over = active.length <= 1;
  return {
    ...state,
    players,
    phase: over ? "over" : "reveal",
    lastResult,
    winner: over ? (active[0]?.id ?? null) : null,
  };
}

/** From "reveal": the loser starts the next round (or the next active player clockwise from them). */
export function nextRound(state: GameState, rng: Rng): GameState {
  if (state.phase !== "reveal") throw new Error(`cannot start the next round during phase "${state.phase}"`);
  const result = state.lastResult;
  if (result === null) throw new Error("no round result");
  const loserState = state.players[result.loser];
  if (loserState === undefined) throw new Error("bad loser");
  const starter = loserState.eliminated ? nextActiveAfter(state.players, result.loser) : result.loser;
  return {
    ...state,
    players: deal(state.players, rng),
    round: state.round + 1,
    starter,
    turn: starter,
    bids: [],
    phase: "bidding",
    // Spec reading: lastResult is "set during reveal and over", so it is cleared once bidding resumes.
    lastResult: null,
    winner: null,
  };
}
