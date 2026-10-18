/**
 * Multiplayer wire protocol, shared by the host server (`server/`) and the
 * browser client. JSON over one WebSocket at `/ws`. The server owns the game;
 * clients send intents and render whatever `view` they are sent.
 *
 * Privacy rule: a `view` only ever carries the receiving seat's own hand while
 * bidding. Everyone's hand goes out on the reveal.
 */
import type { Bid, GameState } from "../engine";
import { bidKey, isLegalBid, parseBidKey } from "../engine";
import type { Difficulty } from "../cpu";
import { DIFFICULTIES } from "../cpu";
import type { BotSpeed, Seat } from "../app/state";
import { BOT_SPEEDS, MAX_CAP, MIN_CAP } from "../app/state";

export const WS_PATH = "/ws";
/** Answers `{ host: true, ... }` only when the page is served by the host server. */
export const HOST_API_PATH = "/api/host";
export const DEFAULT_PORT = 5180;

/** Humans and bots combined. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MAX_NAME_LENGTH = 16;

/** Turn timer choices in seconds; 0 is off. */
export const TURN_TIMERS = [0, 30, 60, 90] as const;
export type TurnTimer = (typeof TURN_TIMERS)[number];

export interface RoomSettings {
  readonly cardCap: number;
  /** Every bot at the table plays at this level. */
  readonly difficulty: Difficulty;
  readonly turnTimer: TurnTimer;
  readonly botSpeed: BotSpeed;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = { cardCap: 6, difficulty: "medium", turnTimer: 60, botSpeed: "normal" };

/** A chair at the table. Every seat, human or bot, is drawn as a painted character. */
export interface SeatInfo extends Seat {
  /** Bots are always connected; a human is connected while their phone is. */
  readonly connected: boolean;
}

/** Who the receiving client is. `seat` is null for the TV table view and other watchers. */
export interface Me {
  readonly seat: number | null;
  /** Keep this (localStorage) to get the same seat back after a reconnect. */
  readonly token: string | null;
  /** May add bots, change settings and start: the laptop itself, or the first player to join. */
  readonly host: boolean;
}

/** The host's LAN address(es) for the join QR code, best first. */
export interface HostInfo {
  readonly host: true;
  readonly urls: readonly string[];
}

export type ClientMsg =
  | { readonly type: "join"; readonly name: string; readonly token?: string }
  | { readonly type: "addBot" }
  | { readonly type: "removeSeat"; readonly seat: number }
  | { readonly type: "setSettings"; readonly settings: Partial<RoomSettings> }
  | { readonly type: "start" }
  | { readonly type: "bid"; readonly bid: Bid }
  | { readonly type: "callBS" }
  | { readonly type: "nextRound" }
  | { readonly type: "rematch" };

export type ServerMsg =
  | {
      readonly type: "lobby";
      readonly me: Me;
      readonly seats: readonly SeatInfo[];
      readonly settings: RoomSettings;
      readonly canStart: boolean;
    }
  | {
      readonly type: "view";
      readonly me: Me;
      readonly seats: readonly SeatInfo[];
      readonly settings: RoomSettings;
      /** The game as this client may see it: other hands are empty while bidding. */
      readonly game: GameState;
      /** Epoch ms when the current turn auto-plays, or null with no timer. */
      readonly deadline: number | null;
      /** One-off line for the table, e.g. "Time's up, auto-played". */
      readonly notice: string | null;
    }
  | { readonly type: "error"; readonly message: string };

/** Trim, strip control characters, cap the length. Empty means "pick one for me". */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/** Merge a settings patch, ignoring anything out of range. */
export function validateRoomSettings(current: RoomSettings, patch: unknown): RoomSettings {
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  const cap = p["cardCap"];
  return {
    cardCap: typeof cap === "number" && Number.isInteger(cap) && cap >= MIN_CAP && cap <= MAX_CAP ? cap : current.cardCap,
    difficulty: DIFFICULTIES.includes(p["difficulty"] as Difficulty) ? (p["difficulty"] as Difficulty) : current.difficulty,
    turnTimer: TURN_TIMERS.includes(p["turnTimer"] as TurnTimer) ? (p["turnTimer"] as TurnTimer) : current.turnTimer,
    botSpeed: BOT_SPEEDS.includes(p["botSpeed"] as BotSpeed) ? (p["botSpeed"] as BotSpeed) : current.botSpeed,
  };
}

/** Parse and shape-check one message from a client. Anything malformed is null. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  switch (m["type"]) {
    case "join": {
      const token = typeof m["token"] === "string" && m["token"].length <= 64 ? m["token"] : undefined;
      return token ? { type: "join", name: cleanName(m["name"]), token } : { type: "join", name: cleanName(m["name"]) };
    }
    case "removeSeat":
      return Number.isInteger(m["seat"]) ? { type: "removeSeat", seat: m["seat"] as number } : null;
    case "setSettings":
      return m["settings"] && typeof m["settings"] === "object"
        ? { type: "setSettings", settings: m["settings"] as Partial<RoomSettings> }
        : null;
    case "bid": {
      const bid = canonicalBid(m["bid"]);
      return bid ? { type: "bid", bid } : null;
    }
    case "addBot":
    case "start":
    case "callBS":
    case "nextRound":
    case "rematch":
      return { type: m["type"] };
    default:
      return null;
  }
}

/** Rebuild a bid from its key, so only real bids with real field types get through ("7" is not 7). */
function canonicalBid(b: unknown): Bid | null {
  if (!b || typeof b !== "object") return null;
  try {
    const bid = parseBidKey(bidKey(b as Bid));
    return isLegalBid(bid) && JSON.stringify(bid) === JSON.stringify(stripExtra(b, bid)) ? bid : null;
  } catch {
    return null;
  }
}

/** The client's object reduced to the canonical bid's fields, in the same order. */
function stripExtra(b: object, like: Bid): Record<string, unknown> {
  const src = b as Record<string, unknown>;
  return Object.fromEntries(Object.keys(like).map((k) => [k, src[k]]));
}
