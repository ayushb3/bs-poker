/**
 * The host's one table. Owns the seats, the settings and the only real copy
 * of the game; runs bot turns with the same CPU code as single player; sends
 * each client a view with only what that seat may see. No sockets in here:
 * `server/host.ts` adapts WebSocket connections to the `Client` interface,
 * and tests drive it with fake clients.
 */
import { randomUUID } from "node:crypto";
import type { Action, GameState, Rng } from "../src/engine";
import { applyAction, bidLabel, bidsEqual, legalActions, newGame, nextRound } from "../src/engine";
import type { Portrait } from "../src/app/state";
import { EXTRA_NAMES, PORTRAITS } from "../src/app/roster";
import { botAction } from "../src/app/cpuTurn";
import { botTiming } from "../src/app/settings";
import type { ClientMsg, Me, RoomSettings, SeatInfo, ServerMsg } from "../src/net/protocol";
import { DEFAULT_ROOM_SETTINGS, MAX_PLAYERS, MIN_PLAYERS, validateRoomSettings } from "../src/net/protocol";

export interface Client {
  readonly id: string;
  /** Connected from the laptop itself (loopback): always has host controls. */
  readonly local: boolean;
  send(msg: ServerMsg): void;
}

interface SeatSlot {
  readonly name: string;
  readonly human: boolean;
  readonly portrait: Portrait;
  readonly variant: 0 | 1;
  /** Humans only: proves a reconnecting phone owns this seat. */
  readonly token: string | null;
  /** Humans only: the client currently holding the seat, if connected. */
  clientId: string | null;
}

export interface RoomOptions {
  readonly rng?: Rng;
  readonly newToken?: () => string;
}

const PORTRAIT_NAME: Record<Portrait, string> = { cipher: "Cipher", vega: "Vega", onyx: "Onyx" };

export class Room {
  private readonly rng: Rng;
  private readonly newToken: () => string;
  private readonly clients = new Map<string, Client>();
  private seats: SeatSlot[] = [];
  private settings: RoomSettings = DEFAULT_ROOM_SETTINGS;
  private game: GameState | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private notice: string | null = null;

  constructor(opts: RoomOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.newToken = opts.newToken ?? randomUUID;
  }

  // ---------- connections ----------

  connect(client: Client): void {
    this.clients.set(client.id, client);
    this.sendTo(client);
  }

  disconnect(clientId: string): void {
    this.clients.delete(clientId);
    const seat = this.seatOf(clientId);
    if (seat === null) return;
    // The chair is kept (shown as away) so a refresh or a dropped Wi-Fi can reclaim it by token.
    // In the lobby the host can give it away with removeSeat.
    this.seats[seat]!.clientId = null;
    this.broadcast();
  }

  handle(clientId: string, msg: ClientMsg): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    const err = this.apply(client, msg);
    if (err) client.send({ type: "error", message: err });
  }

  /** Stop timers (server shutdown, tests). */
  close(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }

  // ---------- messages ----------

  /** Apply one message; returns an error for the sender, or null. */
  private apply(client: Client, msg: ClientMsg): string | null {
    switch (msg.type) {
      case "join":
        return this.join(client, msg.name, msg.token);
      case "addBot":
        return this.addBot(client);
      case "removeSeat":
        return this.removeSeat(client, msg.seat);
      case "setSettings":
        if (!this.isHost(client.id)) return "Only the host can change settings.";
        if (this.game) return "Settings are locked during a game.";
        this.settings = validateRoomSettings(this.settings, msg.settings);
        this.broadcast();
        return null;
      case "start":
        return this.start(client);
      case "bid":
        return this.humanAct(client, { type: "bid", bid: msg.bid });
      case "callBS":
        return this.humanAct(client, { type: "callBS" });
      case "nextRound":
        return this.nextRound(client);
      case "rematch":
        return this.rematch(client);
    }
  }

  private join(client: Client, rawName: string, token: string | undefined): string | null {
    if (this.seatOf(client.id) !== null) return "You already have a seat.";
    // Reconnect: the token proves this is the phone that held the seat.
    if (token) {
      const seat = this.seats.findIndex((s) => s.human && s.token === token);
      if (seat >= 0) {
        const old = this.seats[seat]!.clientId;
        if (old && old !== client.id) this.clients.get(old)?.send({ type: "error", message: "This seat was opened on another device." });
        this.seats[seat]!.clientId = client.id;
        this.broadcast();
        return null;
      }
    }
    if (this.game) return "A game is in progress. You can watch until it ends.";
    if (this.seats.length >= MAX_PLAYERS) return "The table is full.";
    const look = this.nextLook();
    this.seats.push({
      name: this.uniqueName(rawName || `Player ${this.seats.length + 1}`),
      human: true,
      ...look,
      token: this.newToken(),
      clientId: client.id,
    });
    this.broadcast();
    return null;
  }

  private addBot(client: Client): string | null {
    if (!this.isHost(client.id)) return "Only the host can add bots.";
    if (this.game) return "Bots can only be added in the lobby.";
    if (this.seats.length >= MAX_PLAYERS) return "The table is full.";
    const look = this.nextLook();
    const name =
      look.variant === 0 && !this.nameTaken(PORTRAIT_NAME[look.portrait])
        ? PORTRAIT_NAME[look.portrait]
        : (EXTRA_NAMES.find((n) => !this.nameTaken(n)) ?? this.uniqueName("Bot"));
    this.seats.push({ name, human: false, ...look, token: null, clientId: null });
    this.broadcast();
    return null;
  }

  private removeSeat(client: Client, seat: number): string | null {
    const own = this.seatOf(client.id) === seat;
    if (!own && !this.isHost(client.id)) return "Only the host can remove other seats.";
    if (this.game) return "Seats can only change in the lobby.";
    const slot = this.seats[seat];
    if (!slot) return "No such seat.";
    if (slot.clientId && slot.clientId !== client.id) {
      this.clients.get(slot.clientId)?.send({ type: "error", message: "The host gave your seat away." });
    }
    this.seats.splice(seat, 1);
    this.broadcast();
    return null;
  }

  private start(client: Client): string | null {
    if (!this.isHost(client.id)) return "Only the host can start.";
    if (this.game) return "A game is already running.";
    if (this.seats.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players.`;
    this.begin();
    return null;
  }

  private rematch(client: Client): string | null {
    if (!this.game || this.game.phase !== "over") return "The game isn't over yet.";
    if (this.seatOf(client.id) === null && !this.isHost(client.id)) return "Only players can call a rematch.";
    this.begin();
    return null;
  }

  private begin(): void {
    this.game = newGame({ playerCount: this.seats.length, cardCap: this.settings.cardCap }, this.rng);
    this.notice = null;
    this.afterChange();
  }

  private humanAct(client: Client, action: Action): string | null {
    const g = this.game;
    const seat = this.seatOf(client.id);
    if (!g || g.phase !== "bidding") return "Nobody is bidding right now.";
    if (seat === null || g.turn !== seat) return "It's not your turn.";
    const legal = legalActions(g);
    if (action.type === "callBS" && !legal.canCallBS) return "There's nothing to call yet.";
    if (action.type === "bid" && !legal.bids.some((b) => bidsEqual(b, action.bid))) {
      return "That bid has to beat the current one.";
    }
    this.perform(seat, action);
    return null;
  }

  private nextRound(client: Client): string | null {
    const g = this.game;
    if (!g || g.phase !== "reveal") return "There's no round to move on from.";
    if (this.seatOf(client.id) === null && !this.isHost(client.id)) return "Only players can deal the next round.";
    this.game = nextRound(g, this.rng);
    this.notice = null;
    this.afterChange();
    return null;
  }

  // ---------- turns ----------

  private perform(seat: number, action: Action): void {
    const g = this.game;
    if (!g) return;
    const bid = g.bids[g.bids.length - 1]?.bid;
    this.game = applyAction(g, action);
    const who = this.seats[seat]?.name ?? `Player ${seat + 1}`;
    this.notice = action.type === "callBS" ? `${who} calls BS${bid ? ` on ${bidLabel(bid)}` : ""}!` : null;
    this.afterChange();
  }

  /** Broadcast, then schedule the next bot move if a bot is up. */
  private afterChange(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
    this.broadcast();
    const g = this.game;
    if (!g || g.phase !== "bidding") return;
    const slot = this.seats[g.turn];
    if (!slot || slot.human) return;
    const t = botTiming(this.settings.botSpeed);
    const delay = t.thinkMinMs + this.rng() * (t.thinkMaxMs - t.thinkMinMs);
    const seat = g.turn;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const now = this.game;
      if (!now || now.phase !== "bidding" || now.turn !== seat) return;
      const action = botAction(now, seat, this.settings.difficulty, this.rng);
      if (action) this.perform(seat, action);
    }, delay);
  }

  // ---------- views ----------

  private broadcast(): void {
    for (const c of this.clients.values()) this.sendTo(c);
  }

  private sendTo(client: Client): void {
    const seat = this.seatOf(client.id);
    const me: Me = { seat, token: seat === null ? null : this.seats[seat]!.token, host: this.isHost(client.id) };
    const seats = this.seatInfo();
    if (!this.game) {
      client.send({ type: "lobby", me, seats, settings: this.settings, canStart: this.seats.length >= MIN_PLAYERS });
      return;
    }
    client.send({
      type: "view",
      me,
      seats,
      settings: this.settings,
      game: viewFor(this.game, seat),
      deadline: null,
      notice: this.notice,
    });
  }

  private seatInfo(): SeatInfo[] {
    return this.seats.map((s, id) => ({
      id,
      name: s.name,
      human: s.human,
      portrait: s.portrait,
      variant: s.variant,
      connected: !s.human || s.clientId !== null,
    }));
  }

  // ---------- helpers ----------

  private seatOf(clientId: string): number | null {
    const i = this.seats.findIndex((s) => s.clientId === clientId);
    return i < 0 ? null : i;
  }

  /** The laptop (loopback) always; otherwise the earliest-seated connected human. */
  private isHost(clientId: string): boolean {
    if (this.clients.get(clientId)?.local) return true;
    const first = this.seats.find((s) => s.human && s.clientId !== null);
    return first?.clientId === clientId;
  }

  /** The three painted characters first, then mirrored alternates of whichever is least used. */
  private nextLook(): { portrait: Portrait; variant: 0 | 1 } {
    const free = PORTRAITS.find((p) => !this.seats.some((s) => s.portrait === p && s.variant === 0));
    if (free) return { portrait: free, variant: 0 };
    const uses = (p: Portrait) => this.seats.filter((s) => s.portrait === p).length;
    const portrait = [...PORTRAITS].sort((a, b) => uses(a) - uses(b))[0]!;
    return { portrait, variant: 1 };
  }

  private nameTaken(name: string): boolean {
    return this.seats.some((s) => s.name.toLowerCase() === name.toLowerCase());
  }

  private uniqueName(base: string): string {
    if (!this.nameTaken(base)) return base;
    for (let i = 2; ; i++) if (!this.nameTaken(`${base} ${i}`)) return `${base} ${i}`;
  }
}

/** The game as `seat` may see it: while bidding, every other hand is emptied. */
export function viewFor(game: GameState, seat: number | null): GameState {
  if (game.phase !== "bidding") return game;
  return { ...game, players: game.players.map((p) => (p.id === seat ? p : { ...p, hand: [] })) };
}
