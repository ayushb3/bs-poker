import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lightAge } from "./scene";
import { PORTRAIT_ART } from "./assets";

describe("PORTRAIT_ART", () => {
  it("gives every character a silhouette and all three lit moods, all distinct", () => {
    for (const looks of Object.values(PORTRAIT_ART)) {
      const urls = [looks.dark, looks.neutral, looks.smug, looks.caught];
      expect(urls.every((u) => typeof u === "string" && u.length > 0)).toBe(true);
      expect(new Set(urls).size).toBe(4);
      expect(looks.dark).toMatch(/silhouettes/);
      expect(looks.neutral).toMatch(/opponents/);
    }
  });
});

describe("lightAge", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["performance"] }));
  afterEach(() => vi.useRealTimers());

  it("starts at 0 on the change, carries the age through re-renders, then settles", () => {
    expect(lightAge("reveal", true)).toBe(0);
    vi.advanceTimersByTime(400);
    expect(lightAge("reveal", false)).toBeCloseTo(400, -1);
    vi.advanceTimersByTime(2000);
    expect(lightAge("reveal", false)).toBeNull();
  });

  it("only reports the age for the mode the light changed into", () => {
    lightAge("turn", true);
    vi.advanceTimersByTime(100);
    expect(lightAge("reveal", false)).toBeNull();
    expect(lightAge("turn", false)).not.toBeNull();
  });
});
