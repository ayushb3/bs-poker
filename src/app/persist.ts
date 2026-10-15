/**
 * Settings persistence. The controller only sees this tiny interface; main.ts
 * plugs in localStorage. Every read/write is wrapped so a blocked or full
 * storage never breaks the game.
 */
import type { Settings } from "./state";
import { DEFAULT_SETTINGS } from "./state";
import { validateSettings } from "./settings";

export interface SettingsStore {
  load(): Partial<Settings> | null;
  save(settings: Settings): void;
}

export const SETTINGS_KEY = "bs-poker.settings.v1";

/** Minimal shape shared by localStorage and test doubles. */
export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function storageSettingsStore(getStorage: () => StringStorage | null | undefined): SettingsStore {
  return {
    load() {
      try {
        const raw = getStorage()?.getItem(SETTINGS_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return validateSettings(DEFAULT_SETTINGS, parsed as Partial<Settings>);
      } catch {
        return null;
      }
    },
    save(settings) {
      try {
        getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore: private mode, quota, disabled storage */
      }
    },
  };
}

export const NO_STORE: SettingsStore = { load: () => null, save: () => undefined };
