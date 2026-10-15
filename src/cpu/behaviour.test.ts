import { describe, expect, it } from "vitest";
import { mulberry32, shuffle, makeDeck } from "../engine/deck";
import { estimateExists } from "../engine/odds";
import { CATEGORIES, type Bid, type Category } from "../engine/types";
import { cpuDecide, CPU_PARAMS, DIFFICULTIES, tableProbability } from "./index";
import { hardModel, mediumModel } from "./models";
import { fractionExists, samplePools } from "./sampler";
import { cards, makeContext } from "./testUtil";

const SEEDS = Array.from({ length: 40 }, (_, i) => 100 + i);

describe("cpuDecide behaviour", () => {
  it("medium and hard never call BS on a bid their own hand makes certain", () => {
    const current: Bid = { category: "pair", rank: 7 };
    for (const seed of SEEDS) {
      const ctx = makeContext({
        hand: cards("7h", "7c", "7s"),
        poolSize: 12,
        bids: [{ player: 1, bid: current }],
        rng: mulberry32(seed),
      });
      for (const difficulty of ["medium", "hard"] as const) {
        const d = cpuDecide(ctx, difficulty);
        expect(d.action.type, `${difficulty} seed ${seed}`).toBe("bid");
        expect(d.pCurrentExists).toBe(1);
      }
    }
  });

  it("every level calls BS on a bid that is impossible at this pool size", () => {
    const current: Bid = { category: "fiveOfAKind", rank: 14 };
    for (const seed of SEEDS) {
      const ctx = makeContext({ hand: cards("3h", "9c"), poolSize: 4, bids: [{ player: 1, bid: current }], rng: mulberry32(seed) });
      for (const difficulty of DIFFICULTIES) {
        const d = cpuDecide(ctx, difficulty);
        expect(d.action.type, `${difficulty} seed ${seed}`).toBe("callBS");
        expect(d.pCurrentExists).toBe(0);
      }
    }
  });

  it("never calls BS when opening", () => {
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      const hand = shuffle(makeDeck(), rng).slice(0, 1 + Math.floor(rng() * 5));
      const poolSize = hand.length + 2 + Math.floor(rng() * 20);
      const ctx = makeContext({ hand, poolSize, bids: [], rng });
      for (const difficulty of DIFFICULTIES) {
        const d = cpuDecide(ctx, difficulty);
        expect(d.action.type, `${difficulty} seed ${seed}`).toBe("bid");
        expect(d.pCurrentExists).toBeNull();
      }
    }
  });

  it("openings vary with the seed", () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        const ctx = makeContext({ hand: cards("9h", "Kc"), poolSize: 8, bids: [], rng: mulberry32(seed) });
        const d = cpuDecide(ctx, difficulty);
        if (d.action.type === "bid") seen.add(JSON.stringify(d.action.bid));
      }
      expect(seen.size, difficulty).toBeGreaterThan(1);
    }
  });

  it("is deterministic: same context + same seed → same decision", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const make = () =>
          makeContext({
            hand: cards("9h", "Kc", "2d"),
            poolSize: 14,
            bids: [
              { player: 1, bid: { category: "high", rank: 12 } },
              { player: 2, bid: { category: "pair", rank: 5 } },
            ],
            rng: mulberry32(seed),
          });
        expect(cpuDecide(make(), difficulty)).toEqual(cpuDecide(make(), difficulty));
      }
    }
  });

  it("hard treats other players' bids as evidence, but not its own", () => {
    const pair7: Bid = { category: "pair", rank: 7 };
    const hand = cards("3h", "9c", "Kd");
    const params = CPU_PARAMS.hard;
    const others = hardModel(makeContext({ hand, poolSize: 12, bids: [{ player: 1, bid: pair7 }], rng: mulberry32(9) }), { ...params, trials: 4000 });
    const mine = hardModel(makeContext({ hand, poolSize: 12, bids: [{ player: 0, bid: pair7 }], rng: mulberry32(9) }), { ...params, trials: 4000 });
    const none = mediumModel(makeContext({ hand, poolSize: 12, bids: [], rng: mulberry32(9) }), { ...CPU_PARAMS.medium, trials: 4000 });
    const pOthers = others.p(pair7);
    const pMine = mine.p(pair7);
    const pNone = none.p(pair7);
    expect(pOthers).toBeGreaterThan(pNone + 0.05);
    expect(Math.abs(pMine - pNone)).toBeLessThan(0.05);
  });

  it("sampler agrees with the engine's estimateExists", () => {
    const bid: Bid = { category: "twoPair", rank: 9, rank2: 4 };
    const known = cards("9h", "4c", "Jd");
    const samples = samplePools({ known, poolSize: 14, trials: 6000, rng: mulberry32(11) });
    const ours = fractionExists(bid, samples);
    const theirs = estimateExists(bid, { known, poolSize: 14, trials: 6000, rng: mulberry32(12) });
    expect(Math.abs(ours - theirs)).toBeLessThan(0.04);
  });

  it("easy's static table reproduces the SPEC §2 rows (±4 points)", () => {
    const spec: Record<number, number[]> = {
      8: [83, 47, 14, 16, 10, 7, 2, 3, 1, 0.3],
      10: [90, 60, 32, 27, 21, 19, 6, 7, 2, 1],
      12: [94, 72, 51, 39, 36, 36, 14, 14, 5, 3],
      16: [98, 87, 82, 62, 64, 69, 37, 33, 18, 12],
    };
    for (const [pool, row] of Object.entries(spec)) {
      CATEGORIES.forEach((category: Category, i) => {
        const p = 100 * tableProbability(category, Number(pool));
        expect(Math.abs(p - (row[i] as number)), `${category} @ ${pool}`).toBeLessThan(4);
      });
    }
  });

  it("medium and hard decide in under 80ms at pool size 20", () => {
    const deck = shuffle(makeDeck(), mulberry32(3));
    const ctx = makeContext({
      hand: deck.slice(0, 5),
      poolSize: 20,
      bids: [
        { player: 1, bid: { category: "pair", rank: 9 } },
        { player: 2, bid: { category: "straight", rank: 10 } },
        { player: 3, bid: { category: "trips", rank: 11 } },
      ],
      rng: mulberry32(4),
    });
    for (const difficulty of ["medium", "hard"] as const) {
      cpuDecide({ ...ctx, rng: mulberry32(1) }, difficulty); // warm-up (JIT, deck, table)
      const t0 = performance.now();
      const runs = 5;
      for (let i = 0; i < runs; i++) cpuDecide({ ...ctx, rng: mulberry32(10 + i) }, difficulty);
      const ms = (performance.now() - t0) / runs;
      console.log(`${difficulty}: ${ms.toFixed(2)} ms per decision at pool 20`);
      expect(ms).toBeLessThan(80);
    }
    const t0 = performance.now();
    cpuDecide({ ...ctx, rng: mulberry32(1) }, "easy");
    console.log(`easy: ${(performance.now() - t0).toFixed(2)} ms per decision at pool 20`);
  });
});
