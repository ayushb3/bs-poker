import { describe, expect, it } from "vitest";
import { makeDeck, mulberry32 } from "./deck";
import { estimateExists } from "./odds";
import type { Card } from "./types";

const BY_ID = new Map(makeDeck().map((c) => [c.id, c]));
const pool = (...ids: string[]): Card[] => ids.map((id) => BY_ID.get(id) as Card);

describe("estimateExists", () => {
  it("is exactly 1 when the known cards already satisfy the bid", () => {
    expect(estimateExists({ category: "pair", rank: 7 }, { known: pool("7h", "7c"), poolSize: 8, rng: mulberry32(1) })).toBe(1);
    expect(estimateExists({ category: "trips", rank: 7 }, { known: pool("7h", "2c", "J1"), poolSize: 3, rng: mulberry32(1) })).toBe(1);
  });

  it("is exactly 0 for a bid that cannot be reached even if every drawn card were wild", () => {
    // Five of a kind of Aces needs 5 of them; 3 naturals + at most 1 draw can't do it.
    expect(estimateExists({ category: "fiveOfAKind", rank: 14 }, { known: pool("Ah", "Ac", "Ad"), poolSize: 4, rng: mulberry32(1) })).toBe(0);
    expect(estimateExists({ category: "flush", suit: "s" }, { known: pool("Ah", "Kh"), poolSize: 4, rng: mulberry32(1) })).toBe(0);
    expect(estimateExists({ category: "pair", rank: 3 }, { poolSize: 1, rng: mulberry32(1) })).toBe(0);
  });

  it("with no draws the answer is exact", () => {
    expect(estimateExists({ category: "pair", rank: 7 }, { known: pool("7h", "9c"), poolSize: 2 })).toBe(0);
    expect(estimateExists({ category: "high", rank: 7 }, { known: pool("7h", "9c"), poolSize: 2 })).toBe(1);
  });

  it("unconditional estimates match the SPEC table (spot checks)", () => {
    const opts = { poolSize: 8, trials: 20000, rng: mulberry32(42) };
    // Pool 8: pair avg 47%; the named-bid odds are the same for every rank.
    const pair = 100 * estimateExists({ category: "pair", rank: 9 }, opts);
    expect(pair).toBeGreaterThan(44);
    expect(pair).toBeLessThan(50);
    // Pool 8: high card avg 83%.
    const high = 100 * estimateExists({ category: "high", rank: 12 }, opts);
    expect(high).toBeGreaterThan(80);
    expect(high).toBeLessThan(86);
    // Pool 12: flush avg 36%.
    const flush = 100 * estimateExists({ category: "flush", suit: "h" }, { poolSize: 12, trials: 20000, rng: mulberry32(7) });
    expect(flush).toBeGreaterThan(33);
    expect(flush).toBeLessThan(39);
  });

  it("conditioning on known cards moves the estimate", () => {
    const base = estimateExists({ category: "pair", rank: 9 }, { poolSize: 8, trials: 4000, rng: mulberry32(3) });
    const withNine = estimateExists({ category: "pair", rank: 9 }, { known: pool("9h", "4c"), poolSize: 8, trials: 4000, rng: mulberry32(3) });
    const withoutNine = estimateExists({ category: "pair", rank: 9 }, { known: pool("Kh", "4c"), poolSize: 8, trials: 4000, rng: mulberry32(3) });
    expect(withNine).toBeGreaterThan(base);
    expect(withoutNine).toBeLessThan(base);
  });

  it("is deterministic with a seeded rng and fast", () => {
    const a = estimateExists({ category: "fullHouse", rank: 9, rank2: 4 }, { poolSize: 20, trials: 5000, rng: mulberry32(5) });
    const b = estimateExists({ category: "fullHouse", rank: 9, rank2: 4 }, { poolSize: 20, trials: 5000, rng: mulberry32(5) });
    expect(a).toBe(b);
    const t0 = performance.now();
    estimateExists({ category: "straightFlush", rank: 10, suit: "d" }, { poolSize: 20, trials: 5000, rng: mulberry32(6) });
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it("validates its inputs", () => {
    expect(() => estimateExists({ category: "pair", rank: 7 }, { known: pool("7h", "7c"), poolSize: 1 })).toThrow();
    expect(() => estimateExists({ category: "pair", rank: 7 }, { poolSize: 55 })).toThrow();
    expect(() => estimateExists({ category: "pair", rank: 7 }, { poolSize: 8, trials: 0 })).toThrow();
  });
});
