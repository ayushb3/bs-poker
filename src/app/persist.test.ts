import { describe, expect, it } from "vitest";
import { SETTINGS_KEY, storageSettingsStore, type StringStorage } from "./persist";
import { DEFAULT_SETTINGS } from "./state";

function memStorage(initial: Record<string, string> = {}): StringStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("storageSettingsStore", () => {
  it("round-trips settings", () => {
    const mem = memStorage();
    const store = storageSettingsStore(() => mem);
    store.save({ ...DEFAULT_SETTINGS, bots: 2, difficulty: "easy" });
    expect(store.load()).toEqual({ bots: 2, difficulty: "easy", cardCap: DEFAULT_SETTINGS.cardCap, botSpeed: "normal" });
  });

  it("round-trips bot speed and fills it in for settings saved before it existed", () => {
    const mem = memStorage();
    storageSettingsStore(() => mem).save({ ...DEFAULT_SETTINGS, botSpeed: "instant" });
    expect(storageSettingsStore(() => mem).load()?.botSpeed).toBe("instant");
    const old = memStorage({ [SETTINGS_KEY]: JSON.stringify({ bots: 4, difficulty: "hard", cardCap: 5 }) });
    expect(storageSettingsStore(() => old).load()).toEqual({ bots: 4, difficulty: "hard", cardCap: 5, botSpeed: "normal" });
    const bad = memStorage({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, botSpeed: "ludicrous" }) });
    expect(storageSettingsStore(() => bad).load()?.botSpeed).toBe("normal");
  });

  it("ignores corrupt or missing data and storage that throws", () => {
    expect(storageSettingsStore(() => memStorage({ [SETTINGS_KEY]: "{not json" })).load()).toBeNull();
    expect(storageSettingsStore(() => memStorage({ [SETTINGS_KEY]: "[1,2]" })).load()).toEqual(DEFAULT_SETTINGS);
    expect(storageSettingsStore(() => null).load()).toBeNull();
    const boom: StringStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = storageSettingsStore(() => boom);
    expect(store.load()).toBeNull();
    expect(() => store.save(DEFAULT_SETTINGS)).not.toThrow();
    expect(() => storageSettingsStore(() => { throw new Error("no window"); }).save(DEFAULT_SETTINGS)).not.toThrow();
  });
});
