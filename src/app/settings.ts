/** Settings validation: pure, shared by the controller and tests. */
import { DIFFICULTIES } from "../cpu";
import type { Settings } from "./state";
import { DEFAULT_SETTINGS, MAX_BOTS, MAX_CAP, MIN_BOTS, MIN_CAP } from "./state";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Merge a patch into settings, clamping bots to 1..5, card cap to 4..8 and rejecting unknown difficulties. */
export function validateSettings(current: Settings, patch: Partial<Settings> = {}): Settings {
  const merged = { ...current, ...patch };
  return {
    bots: clampInt(merged.bots, MIN_BOTS, MAX_BOTS, DEFAULT_SETTINGS.bots),
    cardCap: clampInt(merged.cardCap, MIN_CAP, MAX_CAP, DEFAULT_SETTINGS.cardCap),
    difficulty: DIFFICULTIES.includes(merged.difficulty) ? merged.difficulty : current.difficulty,
  };
}
