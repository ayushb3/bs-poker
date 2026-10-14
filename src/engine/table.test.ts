import { describe, expect, it } from "vitest";
import { allBids } from "./bids";
import { makeDeck, mulberry32 } from "./deck";
import { addCard, emptyCounts, existsInCounts } from "./exists";
import { CATEGORIES, type Bid, type Card, type Category } from "./types";

/** SPEC §2: average P(named bid exists) per category, in percent. */
const SPEC: Readonly<Record<number, Readonly<Record<Category, number>>>> = {
  8: { high: 83, pair: 47, straight: 14, trips: 16, twoPair: 10, flush: 7, fullHouse: 2, quads: 3, straightFlush: 1, fiveOfAKind: 0.3 },
  10: { high: 90, pair: 60, straight: 32, trips: 27, twoPair: 21, flush: 19, fullHouse: 6, quads: 7, straightFlush: 2, fiveOfAKind: 1 },
  12: { high: 94, pair: 72, straight: 51, trips: 39, twoPair: 36, flush: 36, fullHouse: 14, quads: 14, straightFlush: 5, fiveOfAKind: 3 },
  16: { high: 98, pair: 87, straight: 82, trips: 62, twoPair: 64, flush: 69, fullHouse: 37, quads: 33, straightFlush: 18, fiveOfAKind: 12 },
};

const TOLERANCE = 2.5;
const N = 8000;

/** Average P(exists) over each category's bids, from N random pools of `size` cards. */
function simulate(size: number, seed: number): Record<Category, number> {
  const deck = makeDeck();
  const bids = allBids();
  const rng = mulberry32(seed);
  const hits = new Uint32Array(bids.length);
  const idx = deck.map((_, i) => i);
  const counts = emptyCounts();
  for (let t = 0; t < N; t++) {
    counts.rankCount.fill(0);
    counts.suitCount.fill(0);
    counts.suitRanks.fill(0);
    counts.wilds = 0;
    for (let i = 0; i < size; i++) {
      const j = i + Math.floor(rng() * (idx.length - i));
      const a = idx[i] as number;
      idx[i] = idx[j] as number;
      idx[j] = a;
      addCard(counts, deck[idx[i] as number] as Card);
    }
    for (let b = 0; b < bids.length; b++) {
      if (existsInCounts(bids[b] as Bid, counts)) hits[b] = (hits[b] ?? 0) + 1;
    }
  }
  const out = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    let sum = 0;
    let n = 0;
    for (let b = 0; b < bids.length; b++) {
      if ((bids[b] as Bid).category === c) {
        sum += (hits[b] ?? 0) / N;
        n++;
      }
    }
    out[c] = (100 * sum) / n;
  }
  return out;
}

describe("SPEC §2 named-bid table", () => {
  it(`reproduces every row within ${TOLERANCE} points (N=${N} pools per size)`, () => {
    const sizes = [8, 10, 12, 16] as const;
    const failures: string[] = [];
    const header = ["pool", ...CATEGORIES].map((h) => h.padStart(14)).join("");
    const lines: string[] = ["Monte Carlo named-bid P(exists) %, computed / spec:", header];
    for (const size of sizes) {
      const got = simulate(size, 1000 + size);
      const want = SPEC[size] as Record<Category, number>;
      const cells = CATEGORIES.map((c) => `${got[c].toFixed(1)} / ${want[c]}`.padStart(14));
      lines.push(`${String(size).padStart(14)}${cells.join("")}`);
      for (const c of CATEGORIES) {
        const diff = Math.abs(got[c] - want[c]);
        if (diff > TOLERANCE) failures.push(`pool ${size} ${c}: got ${got[c].toFixed(1)}, spec ${want[c]}`);
      }
    }
    // Vitest's default reporter hides console.log from passing tests, so write straight to
    // stdout when it is available (node): this table must be visible in CI logs.
    const text = `\n${lines.join("\n")}\n\n`;
    const stdout = (globalThis as { process?: { stdout?: { write(chunk: string): unknown } } }).process?.stdout;
    if (stdout) stdout.write(text);
    else console.log(text);
    expect(failures).toEqual([]);
  });
});
