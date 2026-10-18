import { describe, expect, it } from "vitest";
import { STAGE_W, railTopAt, seatSpots } from "./layout";

const FIG_RATIO = 748 / 520; // tallest portrait (onyx_smug)

describe("seatSpots", () => {
  for (let n = 1; n <= 5; n++) {
    it(`${n} opponent(s): on screen, evenly spaced, never overlapping, rail hides the bottom`, () => {
      const s = seatSpots(n);
      expect(s).toHaveLength(n);
      for (const spot of s) {
        expect(spot.cx - spot.w / 2).toBeGreaterThanOrEqual(0);
        expect(spot.cx + spot.w / 2).toBeLessThanOrEqual(STAGE_W);
        expect(spot.bottom).toBeGreaterThan(railTopAt(spot.cx));
        expect(spot.bottom - spot.w * FIG_RATIO).toBeGreaterThan(110); // clears the header + bid feed
      }
      for (let i = 1; i < n; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        expect(b.cx - b.w / 2).toBeGreaterThanOrEqual(a.cx + a.w / 2 - 1);
      }
      if (n > 1) {
        const gaps = s.slice(1).map((b, i) => b.cx - s[i]!.cx);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
      }
    });
  }
  it("puts a single opponent in the middle", () => {
    expect(seatSpots(1)[0]!.cx).toBe(195);
  });
});
