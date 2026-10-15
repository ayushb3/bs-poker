import { describe, expect, it } from "vitest";
import { makeDeck, mulberry32, newGame, applyAction } from "../engine";
import type { Card } from "../engine";
import { computeRevealOdds, describeHeld, formatOdds, percentPhrase, type RevealOdds } from "./odds";

const BY_ID = new Map(makeDeck().map((c) => [c.id, c]));
const cards = (...ids: string[]): Card[] => ids.map((id) => BY_ID.get(id) as Card);

const base: RevealOdds = {
  bid: { category: "pair", rank: 7 },
  poolSize: 9,
  overall: { p: 0.553, exact: false },
  fromSeat: { p: 0.781, exact: false },
  bidderName: "Vega",
  held: "a 7",
};

describe("percentPhrase", () => {
  it("rounds to whole percents and clamps the extremes", () => {
    expect(percentPhrase(0.553)).toBe("about 55%");
    expect(percentPhrase(0.005)).toBe("under 1%");
    expect(percentPhrase(0)).toBe("under 1%");
    expect(percentPhrase(0.996)).toBe("over 99%");
    expect(percentPhrase(0.5)).toBe("about 50%");
  });
});

describe("formatOdds", () => {
  it("matches the wording template", () => {
    expect(formatOdds(base)).toBe(
      "What were the odds? A Pair of 7s existed in a 9-card pool about 55% of the time. From Vega's seat (holding a 7), it was about 78%.",
    );
  });

  it("says 'From your seat' for the human and omits the holding when there is none", () => {
    expect(formatOdds({ ...base, bidderName: null, held: null })).toBe(
      "What were the odds? A Pair of 7s existed in a 9-card pool about 55% of the time. From your seat, it was about 78%.",
    );
  });

  it("says so plainly when the bid was certain or impossible", () => {
    expect(formatOdds({ ...base, fromSeat: { p: 1, exact: true }, held: "two 7s" })).toContain("From Vega's seat (holding two 7s), it was a sure thing.");
    expect(formatOdds({ ...base, fromSeat: { p: 0, exact: true }, held: null })).toContain("From Vega's seat, it was impossible.");
    expect(formatOdds({ ...base, bid: { category: "fiveOfAKind", rank: 14 }, poolSize: 3, overall: { p: 0, exact: true } })).toContain(
      "A Five of a kind, As was impossible in a 3-card pool.",
    );
    expect(formatOdds({ ...base, overall: { p: 1, exact: true } })).toContain("A Pair of 7s was certain in a 9-card pool.");
  });

  it("uses the sampled extremes rather than 'impossible' when the number is merely tiny", () => {
    const s = formatOdds({ ...base, overall: { p: 0, exact: false }, fromSeat: { p: 0.997, exact: false } });
    expect(s).toContain("under 1% of the time");
    expect(s).toContain("it was over 99%.");
  });

  it("uses 'an' before 8-, 11- and 18-card pools", () => {
    expect(formatOdds({ ...base, poolSize: 8 })).toContain("in an 8-card pool");
    expect(formatOdds({ ...base, poolSize: 11 })).toContain("in an 11-card pool");
    expect(formatOdds({ ...base, poolSize: 18 })).toContain("in an 18-card pool");
    expect(formatOdds({ ...base, poolSize: 12 })).toContain("in a 12-card pool");
  });

  it("handles names ending in s and vowel-initial bids", () => {
    expect(formatOdds({ ...base, bidderName: "Ares" })).toContain("From Ares' seat");
    expect(formatOdds({ ...base, bid: { category: "high", rank: 14 } })).toMatch(/^What were the odds\? A High card A existed/);
  });
});

describe("describeHeld", () => {
  it("names the bidder's witness cards in plain English", () => {
    expect(describeHeld({ category: "pair", rank: 7 }, cards("7h", "9c"))).toBe("a 7");
    expect(describeHeld({ category: "trips", rank: 7 }, cards("7h", "7c", "J1"))).toBe("two 7s and a wild");
    expect(describeHeld({ category: "pair", rank: 8 }, cards("8h"))).toBe("an 8");
    expect(describeHeld({ category: "flush", suit: "h" }, cards("7h", "9h", "Kh", "3c"))).toBe("three ♥");
    expect(describeHeld({ category: "pair", rank: 7 }, cards("9c", "Kd"))).toBeNull();
  });
});

describe("computeRevealOdds", () => {
  it("is deterministic for the same reveal and lands in [0, 1]", () => {
    let g = newGame({ playerCount: 3, cardCap: 6 }, mulberry32(3));
    g = applyAction(g, { type: "bid", bid: { category: "pair", rank: 7 } });
    g = applyAction(g, { type: "callBS" });
    const a = computeRevealOdds(g, "Vega");
    const b = computeRevealOdds(g, "Vega");
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a!.poolSize).toBe(g.lastResult!.pool.length);
    expect(a!.overall.p).toBeGreaterThanOrEqual(0);
    expect(a!.overall.p).toBeLessThanOrEqual(1);
    expect(formatOdds(a!)).toMatch(/^What were the odds\? A Pair of 7s/);
  });

  it("returns null when there is nothing to reveal", () => {
    expect(computeRevealOdds(newGame({ playerCount: 2 }, mulberry32(1)), null)).toBeNull();
  });
});
