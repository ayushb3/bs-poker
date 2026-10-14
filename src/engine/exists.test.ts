import { describe, expect, it } from "vitest";
import { allBids, bidKey } from "./bids";
import { makeDeck, mulberry32, shuffle } from "./deck";
import { exists, explain } from "./exists";
import { RANKS, SUITS, isWild, type Bid, type Card, type Rank, type Suit } from "./types";

/* ---------------------------------------------------------------- helpers */

const DECK = makeDeck();
const BY_ID = new Map(DECK.map((c) => [c.id, c]));

/** Build a pool from ids like "7h", "2c", "J1". */
function pool(...ids: string[]): Card[] {
  return ids.map((id) => {
    const c = BY_ID.get(id);
    if (!c) throw new Error(`unknown card ${id}`);
    return c;
  });
}

function ids(cards: readonly Card[]): string[] {
  return cards.map((c) => c.id);
}

/* ------------------------------------------------------- hand-written cases */

describe("exists: n-of-a-kind", () => {
  it("high card", () => {
    expect(exists({ category: "high", rank: 7 }, pool("7h", "9c"))).toBe(true);
    expect(exists({ category: "high", rank: 8 }, pool("7h", "9c"))).toBe(false);
    expect(exists({ category: "high", rank: 8 }, pool("7h", "J1"))).toBe(true);
    expect(exists({ category: "high", rank: 3 }, [])).toBe(false);
  });

  it("pair", () => {
    expect(exists({ category: "pair", rank: 7 }, pool("7h", "7c"))).toBe(true);
    expect(exists({ category: "pair", rank: 7 }, pool("7h", "2c"))).toBe(true);
    expect(exists({ category: "pair", rank: 7 }, pool("J1", "J2"))).toBe(true);
    expect(exists({ category: "pair", rank: 7 }, pool("7h", "8c", "9d"))).toBe(false);
  });

  it("trips", () => {
    expect(exists({ category: "trips", rank: 9 }, pool("9h", "9c", "9d"))).toBe(true);
    expect(exists({ category: "trips", rank: 9 }, pool("9h", "2d", "J1"))).toBe(true);
    expect(exists({ category: "trips", rank: 9 }, pool("9h", "9c", "8d"))).toBe(false);
  });

  it("quads", () => {
    expect(exists({ category: "quads", rank: 14 }, pool("Ah", "Ac", "Ad", "As"))).toBe(true);
    expect(exists({ category: "quads", rank: 14 }, pool("Ah", "Ac", "2d", "2s"))).toBe(true);
    expect(exists({ category: "quads", rank: 14 }, pool("Ah", "Ac", "Ad", "Kd"))).toBe(false);
  });

  it("five of a kind needs wilds", () => {
    expect(exists({ category: "fiveOfAKind", rank: 5 }, pool("5h", "5c", "5d", "5s"))).toBe(false);
    expect(exists({ category: "fiveOfAKind", rank: 5 }, pool("5h", "5c", "5d", "5s", "J2"))).toBe(true);
    expect(exists({ category: "fiveOfAKind", rank: 5 }, pool("5h", "2c", "2d", "2s", "J2"))).toBe(true);
    expect(exists({ category: "fiveOfAKind", rank: 5 }, pool("2h", "2c", "2d", "2s", "J1", "J2"))).toBe(true);
    expect(exists({ category: "fiveOfAKind", rank: 5 }, pool("5h", "5c", "5d", "5s", "6h", "6c"))).toBe(false);
  });
});

describe("exists: two pair and full house", () => {
  it("two pair", () => {
    expect(exists({ category: "twoPair", rank: 9, rank2: 4 }, pool("9h", "9c", "4d", "4s"))).toBe(true);
    expect(exists({ category: "twoPair", rank: 9, rank2: 4 }, pool("9h", "2c", "4d", "J1"))).toBe(true);
    expect(exists({ category: "twoPair", rank: 9, rank2: 4 }, pool("9h", "9c", "4d", "5s"))).toBe(false);
    expect(exists({ category: "twoPair", rank: 9, rank2: 4 }, pool("9h", "9c", "4d", "5s", "2h"))).toBe(true);
    // Wilds are shared across both pairs: 2 missing, only 1 wild.
    expect(exists({ category: "twoPair", rank: 9, rank2: 4 }, pool("9h", "4d", "2h", "8s"))).toBe(false);
  });

  it("full house", () => {
    expect(exists({ category: "fullHouse", rank: 13, rank2: 4 }, pool("Kh", "Kc", "Kd", "4s", "4h"))).toBe(true);
    expect(exists({ category: "fullHouse", rank: 13, rank2: 4 }, pool("Kh", "Kc", "2d", "4s", "J1"))).toBe(true);
    expect(exists({ category: "fullHouse", rank: 13, rank2: 4 }, pool("Kh", "Kc", "Kd", "4s", "5h"))).toBe(false);
    // Orientation matters: three 4s over two Ks is a different bid.
    expect(exists({ category: "fullHouse", rank: 4, rank2: 13 }, pool("Kh", "Kc", "Kd", "4s", "4h"))).toBe(false);
    expect(exists({ category: "fullHouse", rank: 4, rank2: 13 }, pool("Kh", "Kc", "Kd", "4s", "4h", "J1"))).toBe(true);
  });
});

describe("exists: straights", () => {
  it("natural straight and wild-filled gaps", () => {
    expect(exists({ category: "straight", rank: 7 }, pool("3h", "4c", "5d", "6s", "7h"))).toBe(true);
    expect(exists({ category: "straight", rank: 7 }, pool("3h", "4c", "5d", "6s", "8h"))).toBe(false);
    expect(exists({ category: "straight", rank: 7 }, pool("3h", "4c", "5d", "6s", "J1"))).toBe(true);
    expect(exists({ category: "straight", rank: 11 }, pool("7h", "9c", "Jd", "2s", "2h"))).toBe(true);
    expect(exists({ category: "straight", rank: 11 }, pool("7h", "9c", "Jd", "2s"))).toBe(false);
    // Duplicate ranks don't help.
    expect(exists({ category: "straight", rank: 11 }, pool("7h", "7c", "9c", "9d", "Jd", "2s"))).toBe(false);
  });

  it("window edges: 3-7 is the lowest, 10-A the highest", () => {
    expect(exists({ category: "straight", rank: 14 }, pool("10h", "Jc", "Qd", "Ks", "Ah"))).toBe(true);
    expect(exists({ category: "straight", rank: 14 }, pool("9h", "Jc", "Qd", "Ks", "Ah"))).toBe(false);
    // The window is exactly h-4..h: a 7 with 4-8 present but no 3 is not a 7-high straight.
    expect(exists({ category: "straight", rank: 7 }, pool("4h", "5c", "6d", "7s", "8h"))).toBe(false);
    expect(exists({ category: "straight", rank: 8 }, pool("4h", "5c", "6d", "7s", "8h"))).toBe(true);
    // All wilds make any straight.
    expect(exists({ category: "straight", rank: 9 }, pool("2h", "2c", "2d", "2s", "J1"))).toBe(true);
  });
});

describe("exists: flushes", () => {
  it("flush names a suit only", () => {
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "Jh", "Ah"))).toBe(true);
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "Jh", "Ac"))).toBe(false);
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "Jh", "J1"))).toBe(true);
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "2c", "2d", "J1"))).toBe(true);
    expect(exists({ category: "flush", suit: "s" }, pool("3h", "7h", "9h", "Jh", "Ah"))).toBe(false);
    // A wild 2 keeps its suit only for display: 2h is a wild, not a natural heart.
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "Jh", "2h", "8c"))).toBe(true);
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "2h", "8c", "9d"))).toBe(false);
    expect(exists({ category: "flush", suit: "h" }, pool("3h", "7h", "9h", "2h", "2c", "9d"))).toBe(true);
  });

  it("straight flush", () => {
    expect(exists({ category: "straightFlush", rank: 9, suit: "s" }, pool("5s", "6s", "7s", "8s", "9s"))).toBe(true);
    expect(exists({ category: "straightFlush", rank: 9, suit: "s" }, pool("5s", "6s", "7h", "8s", "9s"))).toBe(false);
    expect(exists({ category: "straightFlush", rank: 9, suit: "s" }, pool("5s", "6s", "7h", "8s", "9s", "2c"))).toBe(true);
    expect(exists({ category: "straightFlush", rank: 9, suit: "h" }, pool("5s", "6s", "7h", "8s", "9s", "2c"))).toBe(false);
    expect(exists({ category: "straightFlush", rank: 14, suit: "c" }, pool("10c", "Jc", "Qc", "J1", "J2"))).toBe(true);
    expect(exists({ category: "straightFlush", rank: 7, suit: "d" }, pool("3d", "4d", "5d", "6d", "7d"))).toBe(true);
  });
});

describe("exists: impossible bids and edge cases", () => {
  it("never exists in a pool that is too small or has no fit", () => {
    expect(exists({ category: "fiveOfAKind", rank: 14 }, pool("Ah", "Ac"))).toBe(false);
    expect(exists({ category: "straightFlush", rank: 14, suit: "s" }, pool("Ah", "Ac", "Ad", "As"))).toBe(false);
    expect(exists({ category: "flush", suit: "c" }, [])).toBe(false);
    expect(exists({ category: "pair", rank: 3 }, [])).toBe(false);
  });

  it("every bid exists with 5 wilds in the pool, and none with 0 cards", () => {
    const fiveWilds = pool("2h", "2c", "2d", "2s", "J1");
    for (const b of allBids()) {
      expect(exists(b, fiveWilds), bidKey(b)).toBe(true);
      expect(exists(b, []), bidKey(b)).toBe(false);
    }
  });

  it("does not mutate the pool", () => {
    const p = Object.freeze(pool("7h", "7c", "2d"));
    expect(exists({ category: "trips", rank: 7 }, p)).toBe(true);
    expect(ids(p)).toEqual(["7h", "7c", "2d"]);
  });
});

/* ------------------------------------------------------------- explain() */

describe("explain", () => {
  it("agrees with exists for every bid on a few pools", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 20; i++) {
      const p = shuffle(DECK, rng).slice(0, 5 + (i % 8));
      for (const b of allBids()) {
        const e = explain(b, p);
        expect(e.exists, bidKey(b)).toBe(exists(b, p));
        expect(e.wildsAvailable).toBe(p.filter(isWild).length);
        if (e.exists) expect(e.shortBy).toBe(0);
        else expect(e.shortBy).toBeGreaterThan(0);
        expect(e.wildsUsed).toBeLessThanOrEqual(e.wildsAvailable);
        for (const c of e.cards) expect(p).toContain(c);
        expect(new Set(e.cards.map((c) => c.id)).size).toBe(e.cards.length);
      }
    }
  });

  it("pair with a natural and a wild", () => {
    const e = explain({ category: "pair", rank: 7 }, pool("9c", "7h", "J1", "4d"));
    expect(e.exists).toBe(true);
    expect(ids(e.cards)).toEqual(["7h", "J1"]);
    expect(e.wildsUsed).toBe(1);
    expect(e.wildsAvailable).toBe(1);
    expect(e.shortBy).toBe(0);
    expect(e.summary).toBe("One 7 + 1 wild");
  });

  it("natural pair uses no wilds even when wilds are present", () => {
    const e = explain({ category: "pair", rank: 7 }, pool("7c", "7h", "J1"));
    expect(ids(e.cards)).toEqual(["7c", "7h"]);
    expect(e.wildsUsed).toBe(0);
    expect(e.summary).toBe("Two 7s");
  });

  it("failed pair: partial contributors and shortBy", () => {
    const e = explain({ category: "pair", rank: 7 }, pool("7h", "9c", "4d"));
    expect(e.exists).toBe(false);
    expect(ids(e.cards)).toEqual(["7h"]);
    expect(e.shortBy).toBe(1);
    expect(e.wildsUsed).toBe(0);
    expect(e.summary).toBe("Only one 7 and no wilds: short by 1");
  });

  it("failed five of a kind with wilds: all wilds consumed", () => {
    const e = explain({ category: "fiveOfAKind", rank: 7 }, pool("7h", "9c", "2d", "J2"));
    expect(e.exists).toBe(false);
    expect(ids(e.cards)).toEqual(["7h", "2d", "J2"]);
    expect(e.wildsUsed).toBe(2);
    expect(e.shortBy).toBe(2);
    expect(e.summary).toBe("Only one 7 + 2 wilds: short by 2");
  });

  it("full house witness lists trips, then pair, then wilds", () => {
    const e = explain({ category: "fullHouse", rank: 13, rank2: 4 }, pool("4s", "Kh", "9c", "Kc", "2d", "4h"));
    expect(e.exists).toBe(true);
    expect(ids(e.cards)).toEqual(["Kh", "Kc", "4s", "4h", "2d"]);
    expect(e.wildsUsed).toBe(1);
    expect(e.summary).toBe("Two Ks and two 4s + 1 wild");
    const short = explain({ category: "fullHouse", rank: 13, rank2: 4 }, pool("4s", "Kh", "9c", "Kc", "2d"));
    expect(short.exists).toBe(false);
    expect(ids(short.cards)).toEqual(["Kh", "Kc", "4s", "2d"]);
    expect(short.shortBy).toBe(1);
    expect(short.summary).toBe("Only two Ks and one 4 + 1 wild: short by 1");
  });

  it("straight witness is one card per rank, ascending, plus wilds for gaps", () => {
    const e = explain({ category: "straight", rank: 11 }, pool("Jd", "7h", "7c", "9c", "2s", "2h", "Ac"));
    expect(e.exists).toBe(true);
    expect(ids(e.cards)).toEqual(["7h", "9c", "Jd", "2s", "2h"]);
    expect(e.wildsUsed).toBe(2);
    expect(e.summary).toBe("7, 9, J present, missing 8, 10 + 2 wilds");
  });

  it("flush witness is five cards of the suit (wilds fill)", () => {
    const e = explain({ category: "flush", suit: "h" }, pool("3h", "7h", "9c", "Jh", "J1", "8c"));
    expect(e.exists).toBe(false);
    expect(ids(e.cards)).toEqual(["3h", "7h", "Jh", "J1"]);
    expect(e.shortBy).toBe(1);
    expect(e.summary).toBe("Only three ♥ + 1 wild: short by 1");
  });

  it("straight flush witness counts only the named suit", () => {
    const e = explain({ category: "straightFlush", rank: 9, suit: "s" }, pool("9s", "7h", "5s", "6s", "8s", "J1"));
    expect(e.exists).toBe(true);
    expect(ids(e.cards)).toEqual(["5s", "6s", "8s", "9s", "J1"]);
    expect(e.summary).toBe("5♠, 6♠, 8♠, 9♠ present, missing 7♠ + 1 wild");
  });
});

/* ----------------------------------------------------- brute-force oracle */

type NaturalValue = { readonly rank: Rank; readonly suit: Suit };
const NATURAL_VALUES: readonly NaturalValue[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

/** Tally of a concrete multiset of natural values (after wilds have been assigned). */
interface Tally {
  readonly rankCount: number[]; // index by rank
  readonly suitCount: Record<Suit, number>;
  readonly ranksInSuit: Record<Suit, Set<Rank>>;
}

function tally(values: readonly NaturalValue[]): Tally {
  const t: Tally = {
    rankCount: new Array<number>(15).fill(0),
    suitCount: { c: 0, d: 0, h: 0, s: 0 },
    ranksInSuit: { c: new Set(), d: new Set(), h: new Set(), s: new Set() },
  };
  for (const v of values) {
    t.rankCount[v.rank] = (t.rankCount[v.rank] ?? 0) + 1;
    t.suitCount[v.suit]++;
    t.ranksInSuit[v.suit].add(v.rank);
  }
  return t;
}

/**
 * Independent checker: given a multiset of natural values (after wilds have been
 * assigned concrete values), does the named hand exist? Written from the rules, not
 * from the exists() formulas.
 */
function holds(bid: Bid, t: Tally): boolean {
  const rc = (r: Rank) => t.rankCount[r] ?? 0;
  const window = (h: Rank): Rank[] => [h - 4, h - 3, h - 2, h - 1, h] as Rank[];
  switch (bid.category) {
    case "high":
      return rc(bid.rank) >= 1;
    case "pair":
      return rc(bid.rank) >= 2;
    case "trips":
      return rc(bid.rank) >= 3;
    case "quads":
      return rc(bid.rank) >= 4;
    case "fiveOfAKind":
      return rc(bid.rank) >= 5;
    case "twoPair":
      return rc(bid.rank) >= 2 && rc(bid.rank2) >= 2;
    case "fullHouse":
      return rc(bid.rank) >= 3 && rc(bid.rank2) >= 2;
    case "straight":
      return window(bid.rank).every((r) => rc(r) >= 1);
    case "flush":
      return t.suitCount[bid.suit] >= 5;
    case "straightFlush": {
      const set = t.ranksInSuit[bid.suit];
      return window(bid.rank).every((r) => set.has(r));
    }
  }
}

/**
 * The set of bids (by index into allBids) that hold under at least one assignment of
 * the wilds. Wilds are interchangeable, so assignments are enumerated as multisets
 * (combinations with repetition over the 48 natural values).
 */
function oracle(p: readonly Card[]): Set<number> {
  const bids = allBids();
  const fixed: NaturalValue[] = [];
  let wilds = 0;
  for (const c of p) {
    if (c.kind === "natural") fixed.push({ rank: c.rank, suit: c.suit });
    else wilds++;
  }
  const result = new Set<number>();
  const assigned: NaturalValue[] = [];
  const recurse = (remaining: number, start: number): void => {
    if (remaining === 0) {
      const t = tally([...fixed, ...assigned]);
      for (let i = 0; i < bids.length; i++) {
        if (!result.has(i) && holds(bids[i] as Bid, t)) result.add(i);
      }
      return;
    }
    for (let v = start; v < NATURAL_VALUES.length; v++) {
      assigned.push(NATURAL_VALUES[v] as NaturalValue);
      recurse(remaining - 1, v);
      assigned.pop();
    }
  };
  recurse(wilds, 0);
  return result;
}

/** Random pool of `size` cards with exactly `wilds` wild cards. */
function randomPool(rng: () => number, size: number, wilds: number): Card[] {
  const nats = shuffle(
    DECK.filter((c) => c.kind === "natural"),
    rng,
  );
  const ws = shuffle(DECK.filter(isWild), rng);
  return shuffle([...nats.slice(0, size - wilds), ...ws.slice(0, wilds)], rng);
}

describe("exists vs brute-force oracle", () => {
  it("agrees for every bid on random pools of 5..8 cards with 0..2 wilds", () => {
    const rng = mulberry32(20261014);
    const bids = allBids();
    let pools = 0;
    for (let i = 0; i < 240; i++) {
      const size = 5 + Math.floor(rng() * 4);
      const wilds = Math.floor(rng() * 3);
      const p = randomPool(rng, size, wilds);
      const truth = oracle(p);
      for (let b = 0; b < bids.length; b++) {
        expect(exists(bids[b] as Bid, p), `${ids(p).join(" ")} :: ${bidKey(bids[b] as Bid)}`).toBe(truth.has(b));
      }
      pools++;
    }
    expect(pools).toBe(240);
  });

  it("agrees for every bid on pools of 5..6 cards with 3 wilds", () => {
    const rng = mulberry32(7);
    const bids = allBids();
    for (let i = 0; i < 8; i++) {
      const p = randomPool(rng, 5 + (i % 2), 3);
      const truth = oracle(p);
      for (let b = 0; b < bids.length; b++) {
        expect(exists(bids[b] as Bid, p), `${ids(p).join(" ")} :: ${bidKey(bids[b] as Bid)}`).toBe(truth.has(b));
      }
    }
  });

  it("agrees on hand-picked tricky pools", () => {
    const bids = allBids();
    const pools = [
      pool("7h", "7c", "9c", "9d", "Jd", "2s"), // duplicate ranks + 1 wild
      pool("3s", "4s", "5s", "6s", "8s", "2h"), // near straight flush
      pool("Ah", "Ac", "Ad", "As", "J1", "J2"), // five/six of a kind territory
      pool("10c", "Jc", "Qc", "Kd", "2d", "2c"), // broadway-ish
      pool("3h", "3c", "4h", "4c", "2d"), // two pair + wild
    ];
    for (const p of pools) {
      const truth = oracle(p);
      for (let b = 0; b < bids.length; b++) {
        expect(exists(bids[b] as Bid, p), `${ids(p).join(" ")} :: ${bidKey(bids[b] as Bid)}`).toBe(truth.has(b));
      }
    }
  });
});
