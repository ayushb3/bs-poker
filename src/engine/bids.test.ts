import { describe, expect, it } from "vitest";
import { allBids, bidKey, bidLabel, bidsEqual, compare, isLegalBid, legalRaises, parseBidKey, rankLabel, suitSymbol } from "./bids";
import { CATEGORIES, type Bid, type Category } from "./types";

const bids = allBids();
const byCategory = (c: Category) => bids.filter((b) => b.category === c);

describe("ladder", () => {
  it("each category's lowest bid beats the previous category's highest", () => {
    for (let i = 1; i < CATEGORIES.length; i++) {
      const prev = byCategory(CATEGORIES[i - 1] as Category);
      const next = byCategory(CATEGORIES[i] as Category);
      const prevHigh = prev[prev.length - 1] as Bid;
      const nextLow = next[0] as Bid;
      expect(compare(nextLow, prevHigh), `${bidKey(nextLow)} > ${bidKey(prevHigh)}`).toBeGreaterThan(0);
    }
  });

  it("follows the SPEC order", () => {
    expect(CATEGORIES).toEqual([
      "high",
      "pair",
      "straight",
      "trips",
      "twoPair",
      "flush",
      "fullHouse",
      "quads",
      "straightFlush",
      "fiveOfAKind",
    ]);
  });

  it("orders within a category by rank, then rank2 / suit", () => {
    expect(compare({ category: "pair", rank: 7 }, { category: "pair", rank: 8 })).toBeLessThan(0);
    expect(compare({ category: "twoPair", rank: 9, rank2: 8 }, { category: "twoPair", rank: 9, rank2: 3 })).toBeGreaterThan(0);
    expect(compare({ category: "twoPair", rank: 10, rank2: 3 }, { category: "twoPair", rank: 9, rank2: 8 })).toBeGreaterThan(0);
    expect(compare({ category: "fullHouse", rank: 4, rank2: 14 }, { category: "fullHouse", rank: 5, rank2: 3 })).toBeLessThan(0);
    expect(compare({ category: "flush", suit: "c" }, { category: "flush", suit: "d" })).toBeLessThan(0);
    expect(compare({ category: "flush", suit: "h" }, { category: "flush", suit: "s" })).toBeLessThan(0);
    expect(compare({ category: "straightFlush", rank: 9, suit: "s" }, { category: "straightFlush", rank: 10, suit: "c" })).toBeLessThan(0);
    expect(compare({ category: "straightFlush", rank: 9, suit: "c" }, { category: "straightFlush", rank: 9, suit: "d" })).toBeLessThan(0);
  });
});

describe("compare", () => {
  it("is antisymmetric and reflexive on allBids", () => {
    for (const a of bids) {
      expect(compare(a, a)).toBe(0);
      for (const b of bids) {
        expect(Math.sign(compare(a, b)) + Math.sign(compare(b, a))).toBe(0);
      }
    }
  });

  it("is transitive on allBids (sampled triples)", () => {
    // Full O(n^3) is 27M triples; check every (i, j, k) with a stride instead.
    const n = bids.length;
    for (let i = 0; i < n; i += 7) {
      for (let j = 0; j < n; j += 5) {
        for (let k = 0; k < n; k += 3) {
          const a = bids[i] as Bid;
          const b = bids[j] as Bid;
          const c = bids[k] as Bid;
          if (compare(a, b) < 0 && compare(b, c) < 0) expect(compare(a, c)).toBeLessThan(0);
          if (compare(a, b) === 0 && compare(b, c) === 0) expect(compare(a, c)).toBe(0);
        }
      }
    }
  });
});

describe("allBids", () => {
  it("has 302 bids with the expected per-category counts", () => {
    expect(bids.length).toBe(302);
    expect(byCategory("high").length).toBe(12);
    expect(byCategory("pair").length).toBe(12);
    expect(byCategory("straight").length).toBe(8);
    expect(byCategory("trips").length).toBe(12);
    expect(byCategory("twoPair").length).toBe(66);
    expect(byCategory("flush").length).toBe(4);
    expect(byCategory("fullHouse").length).toBe(132);
    expect(byCategory("quads").length).toBe(12);
    expect(byCategory("straightFlush").length).toBe(32);
    expect(byCategory("fiveOfAKind").length).toBe(12);
  });

  it("is strictly ascending under compare", () => {
    for (let i = 1; i < bids.length; i++) {
      expect(compare(bids[i - 1] as Bid, bids[i] as Bid)).toBeLessThan(0);
    }
  });

  it("is deduplicated by key", () => {
    expect(new Set(bids.map(bidKey)).size).toBe(bids.length);
  });

  it("has well-formed straights, two pairs and full houses", () => {
    for (const b of byCategory("straight")) {
      if (b.category === "straight") expect(b.rank).toBeGreaterThanOrEqual(7);
    }
    for (const b of byCategory("straightFlush")) {
      if (b.category === "straightFlush") expect(b.rank).toBeGreaterThanOrEqual(7);
    }
    for (const b of byCategory("twoPair")) {
      if (b.category === "twoPair") expect(b.rank).toBeGreaterThan(b.rank2);
    }
    for (const b of byCategory("fullHouse")) {
      if (b.category === "fullHouse") expect(b.rank).not.toBe(b.rank2);
    }
    expect(isLegalBid({ category: "straight", rank: 6 })).toBe(false);
    expect(isLegalBid({ category: "twoPair", rank: 3, rank2: 9 })).toBe(false);
    expect(isLegalBid({ category: "fullHouse", rank: 9, rank2: 9 })).toBe(false);
    expect(isLegalBid({ category: "straight", rank: 7 })).toBe(true);
  });
});

describe("legalRaises", () => {
  it("returns every bid for null", () => {
    expect(legalRaises(null)).toBe(bids);
  });

  it("returns only bids strictly above the current one, for every bid", () => {
    for (let i = 0; i < bids.length; i++) {
      const current = bids[i] as Bid;
      const raises = legalRaises(current);
      expect(raises.length).toBe(bids.length - i - 1);
      for (const r of raises) expect(compare(r, current)).toBeGreaterThan(0);
    }
    expect(legalRaises(bids[bids.length - 1] as Bid)).toEqual([]);
  });
});

describe("bidKey / parseBidKey", () => {
  it("round-trips every bid", () => {
    for (const b of bids) {
      const parsed = parseBidKey(bidKey(b));
      expect(parsed).toEqual(b);
      expect(bidsEqual(parsed, b)).toBe(true);
    }
  });

  it("uses the documented format", () => {
    expect(bidKey({ category: "fullHouse", rank: 13, rank2: 4 })).toBe("fullHouse:13:4");
    expect(bidKey({ category: "flush", suit: "h" })).toBe("flush:h");
    expect(bidKey({ category: "straightFlush", rank: 9, suit: "s" })).toBe("straightFlush:9:s");
    expect(bidKey({ category: "pair", rank: 7 })).toBe("pair:7");
  });

  it("rejects malformed keys", () => {
    for (const bad of ["", "pair", "pair:2", "pair:15", "straight:6", "twoPair:3:9", "fullHouse:9:9", "flush:x", "flush:h:3", "nope:7", "straightFlush:9", "pair:7:8", "pair: 7", "pair:7.0", "pair:0x7"]) {
      expect(() => parseBidKey(bad), bad).toThrow();
    }
  });
});

describe("labels", () => {
  it("rankLabel and suitSymbol", () => {
    expect(rankLabel(10)).toBe("10");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(12)).toBe("Q");
    expect(rankLabel(13)).toBe("K");
    expect(rankLabel(14)).toBe("A");
    expect(rankLabel(3)).toBe("3");
    expect(suitSymbol("c")).toBe("♣");
    expect(suitSymbol("d")).toBe("♦");
    expect(suitSymbol("h")).toBe("♥");
    expect(suitSymbol("s")).toBe("♠");
  });

  it("bidLabel samples", () => {
    expect(bidLabel({ category: "high", rank: 14 })).toBe("High card A");
    expect(bidLabel({ category: "pair", rank: 7 })).toBe("Pair of 7s");
    expect(bidLabel({ category: "straight", rank: 11 })).toBe("Straight to J");
    expect(bidLabel({ category: "trips", rank: 9 })).toBe("Three of a kind, 9s");
    expect(bidLabel({ category: "twoPair", rank: 14, rank2: 9 })).toBe("Two pair, As over 9s");
    expect(bidLabel({ category: "flush", suit: "h" })).toBe("Flush in ♥");
    expect(bidLabel({ category: "fullHouse", rank: 13, rank2: 4 })).toBe("Full house, Ks over 4s");
    expect(bidLabel({ category: "quads", rank: 10 })).toBe("Four of a kind, 10s");
    expect(bidLabel({ category: "straightFlush", rank: 9, suit: "s" })).toBe("Straight flush to 9 in ♠");
    expect(bidLabel({ category: "fiveOfAKind", rank: 12 })).toBe("Five of a kind, Qs");
  });
});
