import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mulberry32 } from "../engine";
import { createApp, HUMAN } from "./controller";
import { botTiming, validateSettings } from "./settings";
import type { BotSpeed } from "./state";
import { BOT_SPEEDS, DEFAULT_SETTINGS } from "./state";
import type { SettingsStore } from "./persist";

describe("bot speed settings", () => {
  it("defaults to Normal, which keeps the original timing", () => {
    expect(DEFAULT_SETTINGS.botSpeed).toBe("normal");
    expect(botTiming("normal")).toEqual({ thinkMinMs: 700, thinkMaxMs: 1200, bsFlashMs: 900, anim: 1 });
  });

  it("scales Slow 1.6x and Fast 0.4x; Instant keeps only a short beat", () => {
    expect(botTiming("slow").thinkMinMs).toBeCloseTo(1120);
    expect(botTiming("slow").thinkMaxMs).toBeCloseTo(1920);
    expect(botTiming("fast").thinkMinMs).toBeCloseTo(280);
    expect(botTiming("fast").thinkMaxMs).toBeCloseTo(480);
    const instant = botTiming("instant");
    expect(instant.thinkMinMs).toBe(instant.thinkMaxMs);
    expect(instant.thinkMinMs).toBeGreaterThan(0);
    expect(instant.thinkMinMs).toBeLessThan(botTiming("fast").thinkMinMs);
  });

  it("only Fast and Instant shorten the deal and flip animations", () => {
    expect(botTiming("slow").anim).toBe(1);
    expect(botTiming("normal").anim).toBe(1);
    expect(botTiming("fast").anim).toBeLessThan(1);
    expect(botTiming("instant").anim).toBeLessThan(botTiming("fast").anim);
  });

  it("validates: known speeds pass, unknown ones keep the current value", () => {
    for (const s of BOT_SPEEDS) expect(validateSettings(DEFAULT_SETTINGS, { botSpeed: s }).botSpeed).toBe(s);
    const fast = { ...DEFAULT_SETTINGS, botSpeed: "fast" as BotSpeed };
    expect(validateSettings(fast, { botSpeed: "warp" as never }).botSpeed).toBe("fast");
    expect(validateSettings({ ...DEFAULT_SETTINGS, botSpeed: undefined as never }).botSpeed).toBe("normal");
  });
});

describe("controller: bot speed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Start a game and return the app once a CPU is thinking (human opens if it's their lead). */
  function untilCpuThinks(speed: BotSpeed, seed = 5) {
    const app = createApp(mulberry32(seed));
    app.actions.setSettings({ botSpeed: speed });
    app.actions.startGame();
    const s = app.getState();
    if (s.game!.turn === HUMAN) {
      app.actions.pickCategory(s.picker.category ?? "high");
      app.actions.confirmBid();
    }
    expect(app.getState().thinking).not.toBeNull();
    return app;
  }

  function msUntilMove(speed: BotSpeed): number {
    const app = untilCpuThinks(speed);
    const before = app.getState().game!.bids.length;
    let ms = 0;
    while (app.getState().game!.bids.length === before && app.getState().flash === null && ms < 5000) {
      vi.advanceTimersByTime(10);
      ms += 10;
    }
    return ms;
  }

  it("Instant bots move after a short beat, Slow bots take longer than Normal", () => {
    expect(msUntilMove("instant")).toBeLessThanOrEqual(260);
    expect(msUntilMove("instant")).toBeGreaterThan(0);
    const normal = msUntilMove("normal");
    expect(normal).toBeGreaterThanOrEqual(700);
    expect(msUntilMove("slow")).toBeGreaterThan(normal);
  });

  it("Hurry them along still skips the wait at any speed", () => {
    for (const speed of BOT_SPEEDS) {
      const app = untilCpuThinks(speed);
      const seat = app.getState().thinking;
      app.actions.skipThinking();
      expect(app.getState().thinking).not.toBe(seat);
    }
  });

  it("persists the chosen speed", () => {
    let saved: unknown = null;
    const store: SettingsStore = { load: () => null, save: (s) => void (saved = s) };
    const app = createApp(mulberry32(1), store);
    app.actions.setSettings({ botSpeed: "fast" });
    expect(saved).toMatchObject({ botSpeed: "fast" });
    const reloaded = createApp(mulberry32(1), { load: () => ({ botSpeed: "slow" }), save: () => undefined });
    expect(reloaded.getState().settings.botSpeed).toBe("slow");
  });
});
