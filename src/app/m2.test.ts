import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bidOdds, legalActions, mulberry32 } from "../engine";
import type { Bid } from "../engine";
import { createApp, HUMAN } from "./controller";
import { standings } from "./reveal";
import { formatOdds } from "./odds";
import { validateSettings } from "./settings";
import { DEFAULT_SETTINGS, INITIAL_STATE } from "./state";

describe("bidOdds", () => {
  const pair9: Bid = { category: "pair", rank: 9 };
  it("is deterministic and in [0,1]", () => {
    const a = bidOdds(pair9, 10);
    expect(bidOdds(pair9, 10)).toBe(a);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });
  it("matches the SPEC table roughly (pair, 10 cards ~60%)", () => {
    expect(bidOdds(pair9, 10)).toBeGreaterThan(0.5);
    expect(bidOdds(pair9, 10)).toBeLessThan(0.7);
  });
  it("is monotone in pool size and ladder-ordered", () => {
    expect(bidOdds(pair9, 16)).toBeGreaterThan(bidOdds(pair9, 8));
    expect(bidOdds({ category: "fiveOfAKind", rank: 9 }, 10)).toBeLessThan(bidOdds({ category: "trips", rank: 9 }, 10));
  });
  it("is exactly 0 when impossible", () => {
    expect(bidOdds({ category: "fiveOfAKind", rank: 9 }, 4)).toBe(0);
  });
});

describe("validateSettings", () => {
  it("clamps bots to 1..5 and card cap to 4..8", () => {
    expect(validateSettings(DEFAULT_SETTINGS, { bots: 0 }).bots).toBe(1);
    expect(validateSettings(DEFAULT_SETTINGS, { bots: 99 }).bots).toBe(5);
    expect(validateSettings(DEFAULT_SETTINGS, { cardCap: 2 }).cardCap).toBe(4);
    expect(validateSettings(DEFAULT_SETTINGS, { cardCap: 12 }).cardCap).toBe(8);
    expect(validateSettings(DEFAULT_SETTINGS, { cardCap: 5.6 }).cardCap).toBe(6);
  });
  it("defaults are valid (cap 6) and NaN falls back", () => {
    expect(DEFAULT_SETTINGS.cardCap).toBe(6);
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings(DEFAULT_SETTINGS, { bots: NaN }).bots).toBe(DEFAULT_SETTINGS.bots);
  });
  it("rejects unknown difficulty, accepts known", () => {
    expect(validateSettings(DEFAULT_SETTINGS, { difficulty: "nightmare" as never }).difficulty).toBe(DEFAULT_SETTINGS.difficulty);
    expect(validateSettings(DEFAULT_SETTINGS, { difficulty: "hard" }).difficulty).toBe("hard");
  });
});

describe("controller: odds line and rematch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Human calls BS whenever possible, else opens; CPUs are skipped. Runs to the reveal screen. */
  function playToReveal(app: ReturnType<typeof createApp>): void {
    for (let i = 0; i < 200 && app.getState().screen === "game"; i++) {
      const g = app.getState().game!;
      if (app.getState().flash) app.actions.skipThinking();
      else if (g.phase === "bidding" && g.turn === HUMAN) {
        const l = legalActions(g);
        if (l.canCallBS) app.actions.callBS();
        else {
          const b = l.bids[0]!;
          app.actions.pickCategory(b.category);
          app.actions.confirmBid();
        }
      } else app.actions.skipThinking();
    }
  }

  it("sets the odds line when BS is called", () => {
    const app = createApp(mulberry32(1));
    app.actions.startGame();
    expect(app.getState().odds).toBeNull();
    playToReveal(app);
    expect(app.getState().screen).toBe("reveal");
    expect(formatOdds(app.getState().odds!)).toMatch(/^What were the odds\? /);
  });

  it("rematch keeps settings and seats and resets game state", () => {
    const app = createApp(mulberry32(2));
    app.actions.setSettings({ bots: 2, cardCap: 4, difficulty: "hard" });
    app.actions.startGame();
    const seats = app.getState().seats;
    playToReveal(app);
    expect(app.getState().log.length).toBeGreaterThan(0);
    app.actions.rematch();
    const s = app.getState();
    expect(s.screen).toBe("game");
    expect(s.settings).toEqual({ bots: 2, cardCap: 4, difficulty: "hard" });
    expect(s.seats).toBe(seats);
    expect(s.odds).toBeNull();
    expect(s.flash).toBeNull();
    expect(s.game!.round).toBe(1);
    expect(s.game!.bids).toHaveLength(0);
    expect(s.game!.players).toHaveLength(3);
    expect(s.game!.players.every((p) => p.cardCount === 2 && !p.eliminated)).toBe(true);
    expect(s.log.every((e) => e.round === 1)).toBe(true);
    expect(s.game!.config.cardCap).toBe(4);
  });

  it("standings put survivors first", () => {
    const app = createApp(mulberry32(3));
    app.actions.startGame();
    const g = app.getState().game!;
    const rigged = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, eliminated: true, cardCount: 4 } : p)) };
    expect(standings(rigged)[standings(rigged).length - 1]!.id).toBe(0);
  });

  it("initial state has no odds line", () => {
    expect(INITIAL_STATE.odds).toBeNull();
  });
});
