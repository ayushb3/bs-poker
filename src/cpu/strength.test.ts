/**
 * Statistical strength ordering and pacing, from full bot-only games on the engine's
 * game loop. Seeded, so the printed numbers are reproducible.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../engine/deck";
import { runMatch } from "./sim";

const pct = (wins: number, games: number): string => `${((100 * wins) / games).toFixed(1)}%`;

describe("CPU strength ordering (simulated games)", () => {
  it("hard beats easy heads-up", () => {
    const games = 200;
    const m = runMatch([{ difficulty: "hard" }, { difficulty: "easy" }], games, mulberry32(1001));
    console.log(
      `hard vs easy: hard wins ${m.wins[0]}/${games} (${pct(m.wins[0] ?? 0, games)}), ` +
        `avg ${m.avgBidsPerRound.toFixed(2)} bids/round, ${m.avgRounds.toFixed(1)} rounds/game`,
    );
    expect(m.wins[0] ?? 0).toBeGreaterThan(games * 0.6);
  });

  it("medium beats easy heads-up", () => {
    const games = 200;
    const m = runMatch([{ difficulty: "medium" }, { difficulty: "easy" }], games, mulberry32(1002));
    console.log(
      `medium vs easy: medium wins ${m.wins[0]}/${games} (${pct(m.wins[0] ?? 0, games)}), ` +
        `avg ${m.avgBidsPerRound.toFixed(2)} bids/round, ${m.avgRounds.toFixed(1)} rounds/game`,
    );
    expect(m.wins[0] ?? 0).toBeGreaterThan(games * 0.6);
  });

  it("hard beats medium heads-up", () => {
    const games = 120;
    const m = runMatch([{ difficulty: "hard" }, { difficulty: "medium" }], games, mulberry32(1003));
    console.log(
      `hard vs medium: hard wins ${m.wins[0]}/${games} (${pct(m.wins[0] ?? 0, games)}), ` +
        `avg ${m.avgBidsPerRound.toFixed(2)} bids/round, ${m.avgRounds.toFixed(1)} rounds/game`,
    );
    expect(m.wins[0] ?? 0).toBeGreaterThan(games * 0.5);
  });

  it("4-player rounds average 2–6 bids before BS", () => {
    const games = 20;
    const rng = mulberry32(1004);
    const mixed = runMatch(
      [{ difficulty: "easy" }, { difficulty: "medium" }, { difficulty: "hard" }, { difficulty: "medium" }],
      games,
      rng,
    );
    console.log(
      `4p easy/medium/hard/medium: wins ${mixed.wins.join("/")}, ` +
        `avg ${mixed.avgBidsPerRound.toFixed(2)} bids/round, ${mixed.avgRounds.toFixed(1)} rounds/game`,
    );
    expect(mixed.avgBidsPerRound).toBeGreaterThanOrEqual(2);
    expect(mixed.avgBidsPerRound).toBeLessThanOrEqual(6);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const m = runMatch(Array.from({ length: 4 }, () => ({ difficulty })), 12, rng);
      console.log(`4p all-${difficulty}: avg ${m.avgBidsPerRound.toFixed(2)} bids/round, ${m.avgRounds.toFixed(1)} rounds/game`);
      expect(m.avgBidsPerRound).toBeGreaterThanOrEqual(2);
      expect(m.avgBidsPerRound).toBeLessThanOrEqual(6.5);
    }
  });
});
