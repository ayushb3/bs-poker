/**
 * Easy's static table: P(a named bid exists | pool size, category), with no knowledge of
 * any hand. This is the SPEC §2 table, recomputed on demand for any pool size the game can
 * reach (2 players × 1 card .. 6 players × 7 cards) by Monte Carlo with a fixed seed, so it
 * is deterministic. A pool size is sampled once (a few milliseconds), all ten categories are
 * scored on the same samples, and the row is cached.
 *
 * Within a category every named bid has the same unconditional odds (SPEC §3: raising the
 * rank is a free step), so one representative bid per category is enough.
 */
import { mulberry32 } from "../engine/deck";
import { CATEGORIES, type Bid, type Category } from "../engine/types";
import { fractionExists, samplePools } from "./sampler";

export const TABLE_MIN_POOL = 2;
export const TABLE_MAX_POOL = 42;
const TRIALS_PER_POOL = 2000;
const SEED = 0x5eed;

const REPRESENTATIVE: Readonly<Record<Category, Bid>> = {
  high: { category: "high", rank: 9 },
  pair: { category: "pair", rank: 9 },
  straight: { category: "straight", rank: 10 },
  trips: { category: "trips", rank: 9 },
  twoPair: { category: "twoPair", rank: 10, rank2: 7 },
  flush: { category: "flush", suit: "h" },
  fullHouse: { category: "fullHouse", rank: 10, rank2: 7 },
  quads: { category: "quads", rank: 9 },
  straightFlush: { category: "straightFlush", rank: 10, suit: "h" },
  fiveOfAKind: { category: "fiveOfAKind", rank: 9 },
};

const rows = new Map<number, Readonly<Record<Category, number>>>();

function buildRow(poolSize: number): Readonly<Record<Category, number>> {
  // Seed per pool size so a row is the same whatever order rows are first requested in.
  const rng = mulberry32(SEED + poolSize);
  const samples = samplePools({ known: [], poolSize, trials: TRIALS_PER_POOL, rng });
  const row = {} as Record<Category, number>;
  for (const category of CATEGORIES) row[category] = fractionExists(REPRESENTATIVE[category], samples);
  return row;
}

/** Unconditional P(a bid of this category exists) in a pool of `poolSize` cards (clamped to the table). */
export function tableProbability(category: Category, poolSize: number): number {
  const pool = Math.min(TABLE_MAX_POOL, Math.max(TABLE_MIN_POOL, Math.round(poolSize)));
  let row = rows.get(pool);
  if (row === undefined) {
    row = buildRow(pool);
    rows.set(pool, row);
  }
  return row[category];
}
