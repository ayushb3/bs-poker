/** Settings validation: pure, shared by the controller and tests. */
import { DIFFICULTIES } from "../cpu";
import type { BotSpeed, Settings } from "./state";
import { BOT_SPEEDS, DEFAULT_SETTINGS, MAX_BOTS, MAX_CAP, MIN_BOTS, MIN_CAP } from "./state";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Merge a patch into settings, clamping bots to 1..5, card cap to 4..8 and rejecting unknown difficulties and speeds. */
export function validateSettings(current: Settings, patch: Partial<Settings> = {}): Settings {
  const merged = { ...current, ...patch };
  return {
    bots: clampInt(merged.bots, MIN_BOTS, MAX_BOTS, DEFAULT_SETTINGS.bots),
    cardCap: clampInt(merged.cardCap, MIN_CAP, MAX_CAP, DEFAULT_SETTINGS.cardCap),
    difficulty: DIFFICULTIES.includes(merged.difficulty) ? merged.difficulty : current.difficulty,
    botSpeed: BOT_SPEEDS.includes(merged.botSpeed)
      ? merged.botSpeed
      : BOT_SPEEDS.includes(current.botSpeed)
        ? current.botSpeed
        : DEFAULT_SETTINGS.botSpeed,
  };
}

export interface BotTiming {
  /** CPU "thinking" delay window (ms); the human can skip it. */
  readonly thinkMinMs: number;
  readonly thinkMaxMs: number;
  /** How long the "X calls BS!" banner shows before the reveal screen. */
  readonly bsFlashMs: number;
  /** Multiplier for deal and flip animations (1 = full length). */
  readonly anim: number;
}

/** Normal is the original timing; the rest scale it. Instant drops the think but keeps a beat to see who bid. */
const NORMAL: BotTiming = { thinkMinMs: 700, thinkMaxMs: 1200, bsFlashMs: 900, anim: 1 };

export function botTiming(speed: BotSpeed): BotTiming {
  switch (speed) {
    case "slow":
      return { thinkMinMs: NORMAL.thinkMinMs * 1.6, thinkMaxMs: NORMAL.thinkMaxMs * 1.6, bsFlashMs: NORMAL.bsFlashMs * 1.6, anim: 1 };
    case "fast":
      return { thinkMinMs: NORMAL.thinkMinMs * 0.4, thinkMaxMs: NORMAL.thinkMaxMs * 0.4, bsFlashMs: NORMAL.bsFlashMs * 0.6, anim: 0.6 };
    case "instant":
      return { thinkMinMs: 250, thinkMaxMs: 250, bsFlashMs: 450, anim: 0.4 };
    default:
      return NORMAL;
  }
}
