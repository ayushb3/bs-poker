/** View-model helpers added for the Saloon UI: roster portraits, reveal moods, ladder stepping, short odds. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, GameState, RoundResult } from "../engine";
import { legalActions, legalRaises, mulberry32 } from "../engine";
import { createApp, HUMAN } from "./controller";
import { makeSeats, PORTRAITS } from "./roster";
import { outcomeText, revealMood } from "./reveal";
import { defaultPicker, derivePicker, pickerFromBid, stepBid } from "./picker";
import { shortOdds, shortPercent, type RevealOdds } from "./odds";
import { EMPTY_PICKER } from "./state";

describe("makeSeats", () => {
  it("gives the first three bots the three painted portraits, each once", () => {
    for (let seed = 1; seed < 20; seed++) {
      const seats = makeSeats(3, mulberry32(seed));
      expect(seats[0]!.human).toBe(true);
      const ps = seats.slice(1).map((s) => s.portrait);
      expect(new Set(ps)).toEqual(new Set(PORTRAITS));
      expect(seats.slice(1).every((s) => s.variant === 0)).toBe(true);
      const byPortrait = Object.fromEntries(seats.slice(1).map((s) => [s.portrait, s.name]));
      expect(byPortrait).toEqual({ cipher: "Cipher", vega: "Vega", onyx: "Onyx" });
    }
  });
  it("fills 4th and 5th chairs with distinct names and alternate looks", () => {
    const seats = makeSeats(5, mulberry32(7));
    expect(seats).toHaveLength(6);
    expect(new Set(seats.map((s) => s.name)).size).toBe(6);
    expect(seats.slice(4).every((s) => s.variant === 1 && s.portrait != null)).toBe(true);
    expect(seats[4]!.portrait).not.toBe(seats[5]!.portrait);
  });
  it("handles 1 bot", () => {
    const seats = makeSeats(1, mulberry32(3));
    expect(seats).toHaveLength(2);
    expect(seats[1]!.variant).toBe(0);
  });
});

describe("revealMood / outcomeText", () => {
  const base = { round: 1, bid: { category: "pair", rank: 7 } as Bid, pool: [], eliminated: [] } as unknown as RoundResult;
  it("bid was there: the caller is caught, the bidder smug, others neutral", () => {
    const r = { ...base, bidder: 2, caller: 0, existed: true, loser: 0 } as RoundResult;
    expect(revealMood(r, 0)).toBe("caught");
    expect(revealMood(r, 2)).toBe("smug");
    expect(revealMood(r, 1)).toBe("neutral");
  });
  it("bluff caught: the bidder is caught, the caller smug", () => {
    const r = { ...base, bidder: 3, caller: 1, existed: false, loser: 3 } as RoundResult;
    expect(revealMood(r, 3)).toBe("caught");
    expect(revealMood(r, 1)).toBe("smug");
    expect(revealMood(r, 2)).toBe("neutral");
  });
  it("words the outcome for you and for a bot", () => {
    const game = {
      players: [
        { id: 0, cardCount: 3, eliminated: false, hand: [] },
        { id: 1, cardCount: 6, eliminated: true, hand: [] },
      ],
    } as unknown as GameState;
    const who = { name: (s: number) => (s === 0 ? "You" : "Onyx"), human: 0 };
    expect(outcomeText(game, { ...base, loser: 0 } as RoundResult, who)).toEqual({ take: "You take a card.", holding: "Now holding 3." });
    expect(outcomeText(game, { ...base, loser: 1 } as RoundResult, who).take).toBe("Onyx takes a card.");
    expect(outcomeText(game, { ...base, loser: 1 } as RoundResult, who).holding).toContain("out");
  });
});

describe("stepBid", () => {
  const legal = legalRaises({ category: "pair", rank: 9 });
  it("steps up and down the ladder of legal raises and clamps at the ends", () => {
    const start = defaultPicker(legal);
    const up = stepBid(legal, start, 1)!;
    expect(up).toBe(legal[1]);
    expect(stepBid(legal, pickerFromBid(up), -1)).toBe(legal[0]);
    expect(stepBid(legal, start, -1)).toBe(legal[0]);
    const last = legal[legal.length - 1]!;
    expect(stepBid(legal, pickerFromBid(last), 1)).toBe(last);
  });
  it("starts from the cheapest raise when nothing is selected", () => {
    expect(stepBid(legal, EMPTY_PICKER, 1)).toBe(legal[0]);
    expect(stepBid([], EMPTY_PICKER, 1)).toBeNull();
  });
});

describe("controller: pickBid / stepBid", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("selects legal bids only and steps the human's selection", () => {
    // Find a seed where the human gets a turn in round 1 before anyone calls BS.
    let app = createApp(mulberry32(1));
    for (let seed = 1; seed < 40; seed++) {
      app = createApp(mulberry32(seed));
      app.actions.startGame();
      for (let i = 0; i < 10 && app.getState().game!.phase === "bidding" && app.getState().game!.turn !== HUMAN; i++) {
        vi.advanceTimersByTime(1500);
      }
      const g0 = app.getState().game!;
      if (g0.phase === "bidding" && g0.turn === HUMAN && legalActions(g0).bids.length > 6) break;
    }
    const g = app.getState().game!;
    expect(g.turn).toBe(HUMAN);
    const legal = legalActions(g).bids;
    app.actions.stepBid(1);
    expect(derivePicker(legal, app.getState().picker).selected).toBe(legal[1]);
    app.actions.stepBid(-1);
    expect(derivePicker(legal, app.getState().picker).selected).toBe(legal[0]);
    const target = legal[5]!;
    app.actions.pickBid({ ...target });
    expect(derivePicker(legal, app.getState().picker).selected).toBe(target);
    const before = app.getState().picker;
    app.actions.pickBid({ category: "high", rank: 3 });
    if (!legal.some((b) => b.category === "high" && "rank" in b && b.rank === 3)) {
      expect(app.getState().picker).toBe(before);
    }
  });
});

describe("shortOdds", () => {
  const o: RevealOdds = {
    bid: { category: "straight", rank: 9 },
    poolSize: 9,
    overall: { p: 0.221, exact: false },
    fromSeat: { p: 0.41, exact: false },
    bidderName: "Onyx",
    held: "an 8",
  };
  it("prints whole percents and exact words", () => {
    expect(shortPercent({ p: 0.221, exact: false })).toBe("22%");
    expect(shortPercent({ p: 1, exact: true })).toBe("certain");
    expect(shortPercent({ p: 0, exact: true })).toBe("impossible");
    expect(shortPercent({ p: 0.001, exact: false })).toBe("under 1%");
  });
  it("words both lines", () => {
    expect(shortOdds(o)).toEqual({ overall: "Odds it was there: 22%", seat: "From Onyx's seat (holding an 8): 41%" });
    expect(shortOdds({ ...o, bidderName: null, held: null }).seat).toBe("From your seat: 41%");
  });
});
