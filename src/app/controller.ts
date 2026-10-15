/**
 * The app controller: owns the single AppState, drives the engine, schedules
 * CPU turns, and notifies the renderer. No DOM in here.
 */
import type { Bid, Category, GameState, Rank, Rng, Suit } from "../engine";
import { applyAction, bidLabel, legalActions, newGame, nextRound, poolOf } from "../engine";
import type { CpuContext, CpuDecision } from "../cpu";
import { cpuDecide } from "../cpu";
import type { AppState, LogEntry, Seat, Settings } from "./state";
import { EMPTY_PICKER, INITIAL_STATE, MAX_BOTS, MAX_CAP, MIN_BOTS, MIN_CAP } from "./state";
import { makeSeats } from "./roster";
import * as picker from "./picker";

export const HUMAN = 0;

/** CPU "thinking" delay window (ms); the human can skip it. */
const THINK_MIN_MS = 700;
const THINK_MAX_MS = 1200;
/** How long the "X calls BS!" banner shows before the reveal screen. */
const BS_FLASH_MS = 900;

export interface App {
  readonly getState: () => AppState;
  readonly subscribe: (listener: (s: AppState) => void) => () => void;
  readonly actions: Actions;
}

export interface Actions {
  setSettings(patch: Partial<Settings>): void;
  toggleHelp(show?: boolean): void;
  startGame(): void;
  playAgain(): void;
  changeSettings(): void;
  pickCategory(category: Category): void;
  pickRank(rank: Rank): void;
  pickRank2(rank2: Rank): void;
  pickSuit(suit: Suit): void;
  confirmBid(): void;
  callBS(): void;
  skipThinking(): void;
  nextRound(): void;
}

export function createApp(rng: Rng = Math.random): App {
  let state: AppState = INITIAL_STATE;
  const listeners = new Set<(s: AppState) => void>();
  let thinkTimer: ReturnType<typeof setTimeout> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { seat: number; decision: CpuDecision } | null = null;

  function set(patch: Partial<AppState>): void {
    state = { ...state, ...patch };
    for (const l of listeners) l(state);
  }

  function clearTimers(): void {
    if (thinkTimer) clearTimeout(thinkTimer);
    if (flashTimer) clearTimeout(flashTimer);
    thinkTimer = null;
    flashTimer = null;
    pending = null;
  }

  function seatName(seat: number): string {
    return state.seats[seat]?.name ?? `Player ${seat}`;
  }

  function log(game: GameState, kind: LogEntry["kind"], text: string): readonly LogEntry[] {
    return [...state.log, { round: game.round, text, kind }].slice(-60);
  }

  function currentBid(game: GameState): Bid | null {
    return game.bids[game.bids.length - 1]?.bid ?? null;
  }

  /** After any engine transition: reset the picker on the human's turn, or schedule a CPU. */
  function afterChange(game: GameState, extra: Partial<AppState> = {}): void {
    if (game.phase !== "bidding") {
      set({ game, thinking: null, ...extra });
      return;
    }
    if (game.turn === HUMAN) {
      const legal = legalActions(game).bids;
      set({ game, thinking: null, picker: picker.defaultPicker(legal), ...extra });
      return;
    }
    set({ game, thinking: game.turn, picker: EMPTY_PICKER, ...extra });
    scheduleCpu(game);
  }

  function scheduleCpu(game: GameState): void {
    const seat = game.turn;
    const me = game.players[seat];
    if (!me) return;
    const ctx: CpuContext = {
      me: seat,
      hand: me.hand,
      poolSize: poolOf(game).length,
      cardCounts: game.players.map((p) => (p.eliminated ? 0 : p.cardCount)),
      bids: game.bids,
      legalBids: legalActions(game).bids,
      config: game.config,
      rng,
    };
    // Decide now (so "skip" is instant), reveal after a short human-readable delay.
    const decision = cpuDecide(ctx, state.settings.difficulty);
    pending = { seat, decision };
    const delay = THINK_MIN_MS + rng() * (THINK_MAX_MS - THINK_MIN_MS);
    thinkTimer = setTimeout(applyPending, delay);
  }

  function applyPending(): void {
    if (thinkTimer) clearTimeout(thinkTimer);
    thinkTimer = null;
    const p = pending;
    pending = null;
    const game = state.game;
    if (!p || !game || game.phase !== "bidding" || game.turn !== p.seat) return;
    let action = p.decision.action;
    // Defensive: never let a bot stall the table on an illegal action.
    const legal = legalActions(game);
    if (action.type === "callBS" && !legal.canCallBS) {
      const first = legal.bids[0];
      if (!first) return;
      action = { type: "bid", bid: first };
    }
    performAction(p.seat, action);
  }

  function performAction(seat: number, action: { type: "bid"; bid: Bid } | { type: "callBS" }): void {
    const game = state.game;
    if (!game) return;
    const next = applyAction(game, action);
    if (action.type === "bid") {
      afterChange(next, { log: log(next, "bid", `${seatName(seat)}: ${bidLabel(action.bid)}`) });
      return;
    }
    // BS called: flash a banner over the table, then show the reveal.
    const bid = currentBid(game);
    const who = seatName(seat);
    const text = `${who} call${seat === HUMAN ? "" : "s"} BS${bid ? ` on ${bidLabel(bid)}` : ""}!`;
    const entries = [...log(next, "bs", text)];
    const r = next.lastResult;
    if (r) {
      const verdict = r.existed ? "It was there." : "It wasn't there.";
      entries.push({
        round: next.round,
        kind: "result",
        text: `${verdict} ${seatName(r.loser)} take${r.loser === HUMAN ? "" : "s"} a card.`,
      });
      for (const e of r.eliminated) {
        entries.push({ round: next.round, kind: "info", text: `${seatName(e)} is out.` });
      }
    }
    set({ game: next, thinking: null, flash: text, log: entries });
    flashTimer = setTimeout(() => {
      flashTimer = null;
      set({ flash: null, screen: "reveal" });
    }, BS_FLASH_MS);
  }

  function begin(seats: readonly Seat[]): void {
    clearTimers();
    const { bots, cardCap } = state.settings;
    const game = newGame({ playerCount: bots + 1, cardCap }, rng);
    state = { ...state, seats, log: [], flash: null, showHelp: false };
    afterChange(game, { screen: "game" });
  }

  const actions: Actions = {
    setSettings(patch) {
      const s = { ...state.settings, ...patch };
      s.bots = Math.min(MAX_BOTS, Math.max(MIN_BOTS, Math.round(s.bots)));
      s.cardCap = Math.min(MAX_CAP, Math.max(MIN_CAP, Math.round(s.cardCap)));
      set({ settings: s });
    },
    toggleHelp(show) {
      set({ showHelp: show ?? !state.showHelp });
    },
    startGame() {
      begin(makeSeats(state.settings.bots, rng));
    },
    playAgain() {
      const seats = state.seats.length === state.settings.bots + 1 ? state.seats : makeSeats(state.settings.bots, rng);
      begin(seats);
    },
    changeSettings() {
      clearTimers();
      set({ screen: "title", game: null, flash: null, thinking: null });
    },
    pickCategory(category) {
      const g = state.game;
      if (!g) return;
      set({ picker: picker.pickCategory(legalActions(g).bids, category) });
    },
    pickRank(rank) {
      const g = state.game;
      if (!g) return;
      set({ picker: picker.pickRank(legalActions(g).bids, state.picker, rank) });
    },
    pickRank2(rank2) {
      set({ picker: picker.pickRank2(state.picker, rank2) });
    },
    pickSuit(suit) {
      set({ picker: picker.pickSuit(state.picker, suit) });
    },
    confirmBid() {
      const g = state.game;
      if (!g || g.phase !== "bidding" || g.turn !== HUMAN) return;
      const view = picker.derivePicker(legalActions(g).bids, state.picker);
      if (!view.selected) return;
      performAction(HUMAN, { type: "bid", bid: view.selected });
    },
    callBS() {
      const g = state.game;
      if (!g || g.phase !== "bidding" || g.turn !== HUMAN) return;
      if (!legalActions(g).canCallBS) return;
      performAction(HUMAN, { type: "callBS" });
    },
    skipThinking() {
      if (pending) applyPending();
      else if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
        set({ flash: null, screen: "reveal" });
      }
    },
    nextRound() {
      const g = state.game;
      if (!g) return;
      if (g.phase === "over") {
        set({ screen: "over" });
        return;
      }
      if (g.phase !== "reveal") return;
      const next = nextRound(g, rng);
      afterChange(next, { screen: "game" });
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
}
