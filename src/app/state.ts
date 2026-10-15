/**
 * App-level state. The engine's GameState is embedded verbatim; everything
 * else here is UI concern (screen, settings, picker selection, timers).
 */
import type { Category, GameState, Rank, Suit } from "../engine";
import type { Difficulty } from "../cpu";

export interface Settings {
  /** Number of CPU opponents, 1..5. */
  readonly bots: number;
  readonly difficulty: Difficulty;
  /** Card cap, 4..8 (default 6). */
  readonly cardCap: number;
}

export const DEFAULT_SETTINGS: Settings = { bots: 3, difficulty: "medium", cardCap: 6 };
export const MIN_BOTS = 1;
export const MAX_BOTS = 5;
export const MIN_CAP = 4;
export const MAX_CAP = 8;

/** Who sits where. Seat 0 is always the human. */
export interface Seat {
  readonly id: number;
  readonly name: string;
  /** Emoji animal for the offline avatar. */
  readonly critter: string;
  /** Hue (deg) for the avatar's gradient ring. */
  readonly hue: number;
  readonly human: boolean;
}

/** What the human has tapped so far in the bid picker. */
export interface PickerState {
  readonly category: Category | null;
  readonly rank: Rank | null;
  readonly rank2: Rank | null;
  readonly suit: Suit | null;
}

export const EMPTY_PICKER: PickerState = { category: null, rank: null, rank2: null, suit: null };

export type Screen = "title" | "game" | "reveal" | "over";

export interface LogEntry {
  readonly round: number;
  readonly text: string;
  readonly kind: "bid" | "bs" | "result" | "info";
}

export interface AppState {
  readonly screen: Screen;
  readonly settings: Settings;
  readonly showHelp: boolean;
  readonly game: GameState | null;
  readonly seats: readonly Seat[];
  readonly picker: PickerState;
  /** Seat of the CPU whose (skippable) thinking delay is running, else null. */
  readonly thinking: number | null;
  /** Short banner shown over the table, e.g. "Rook calls BS!" */
  readonly flash: string | null;
  readonly log: readonly LogEntry[];
}

export const INITIAL_STATE: AppState = {
  screen: "title",
  settings: DEFAULT_SETTINGS,
  showHelp: false,
  game: null,
  seats: [],
  picker: EMPTY_PICKER,
  thinking: null,
  flash: null,
  log: [],
};
