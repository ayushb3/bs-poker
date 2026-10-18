import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../src/engine";
import { legalActions, mulberry32 } from "../src/engine";
import type { ClientMsg, ServerMsg } from "../src/net/protocol";
import { MAX_PLAYERS } from "../src/net/protocol";
import { Room, type Client } from "./room";

type ViewMsg = Extract<ServerMsg, { type: "view" }>;

interface Fake extends Client {
  readonly inbox: ServerMsg[];
  last(): ServerMsg;
  lastView(): ViewMsg;
  errors(): string[];
}

function fake(id: string, local = false): Fake {
  const inbox: ServerMsg[] = [];
  return {
    id,
    local,
    inbox,
    send: (m) => void inbox.push(JSON.parse(JSON.stringify(m)) as ServerMsg),
    last: () => inbox[inbox.length - 1]!,
    lastView() {
      const v = [...inbox].reverse().find((m) => m.type === "view");
      if (!v || v.type !== "view") throw new Error("no view yet");
      return v;
    },
    errors: () => inbox.flatMap((m) => (m.type === "error" ? [m.message] : [])),
  };
}

function setup(seed = 1) {
  let n = 0;
  const room = new Room({ rng: mulberry32(seed), newToken: () => `tok-${++n}` });
  const send = (c: Fake, msg: ClientMsg) => room.handle(c.id, msg);
  return { room, send };
}

describe("Room lobby", () => {
  it("seats joiners with painted looks, unique clean names and a token", () => {
    const { room, send } = setup();
    const a = fake("a");
    const b = fake("b");
    room.connect(a);
    room.connect(b);
    send(a, { type: "join", name: "Ayush" });
    send(b, { type: "join", name: "ayush" });
    const lobby = b.last();
    expect(lobby.type).toBe("lobby");
    if (lobby.type !== "lobby") return;
    expect(lobby.seats.map((s) => s.name)).toEqual(["Ayush", "ayush 2"]);
    expect(lobby.seats.map((s) => s.portrait)).toEqual(["cipher", "vega"]);
    expect(lobby.me).toEqual({ seat: 1, token: "tok-2", host: false });
    expect(lobby.canStart).toBe(true);
  });

  it("gives host controls to the laptop and to the first player, nobody else", () => {
    const { room, send } = setup();
    const tv = fake("tv", true);
    const a = fake("a");
    const b = fake("b");
    for (const c of [tv, a, b]) room.connect(c);
    send(a, { type: "join", name: "A" });
    send(b, { type: "join", name: "B" });
    send(b, { type: "addBot" });
    expect(b.errors()).toEqual(["Only the host can add bots."]);
    send(a, { type: "addBot" });
    send(tv, { type: "addBot" });
    const l = tv.last();
    if (l.type !== "lobby") throw new Error();
    expect(l.me.host).toBe(true);
    expect(l.seats.filter((s) => !s.human).map((s) => s.name)).toEqual(["Onyx", "Rook"]);
    expect(l.seats[3]!.variant).toBe(1);
  });

  it("caps the table at six and only the host changes settings", () => {
    const { room, send } = setup();
    const tv = fake("tv", true);
    room.connect(tv);
    for (let i = 0; i < MAX_PLAYERS + 1; i++) send(tv, { type: "addBot" });
    expect(tv.errors()).toEqual(["The table is full."]);
    send(tv, { type: "setSettings", settings: { cardCap: 5, turnTimer: 30, difficulty: "hard", botSpeed: "fast" } });
    send(tv, { type: "setSettings", settings: { cardCap: 99, turnTimer: 45 as never } });
    const l = tv.last();
    if (l.type !== "lobby") throw new Error();
    expect(l.seats).toHaveLength(MAX_PLAYERS);
    expect(l.settings).toEqual({ cardCap: 5, turnTimer: 30, difficulty: "hard", botSpeed: "fast" });
    const late = fake("late");
    room.connect(late);
    send(late, { type: "join", name: "Late" });
    expect(late.errors()).toEqual(["The table is full."]);
  });

  it("keeps a dropped player's chair and hands it back by token", () => {
    const { room, send } = setup();
    const a = fake("a");
    room.connect(a);
    send(a, { type: "join", name: "A" });
    room.disconnect("a");
    const tv = fake("tv", true);
    room.connect(tv);
    let l = tv.last();
    if (l.type !== "lobby") throw new Error();
    expect(l.seats[0]!.connected).toBe(false);
    const again = fake("a2");
    room.connect(again);
    send(again, { type: "join", name: "ignored", token: "tok-1" });
    l = again.last();
    if (l.type !== "lobby") throw new Error();
    expect(l.me.seat).toBe(0);
    expect(l.seats).toHaveLength(1);
    expect(l.seats[0]!.connected).toBe(true);
  });

  it("lets the host remove a seat, and a player leave their own", () => {
    const { room, send } = setup();
    const tv = fake("tv", true);
    const a = fake("a");
    const b = fake("b");
    for (const c of [tv, a, b]) room.connect(c);
    send(a, { type: "join", name: "A" });
    send(b, { type: "join", name: "B" });
    send(tv, { type: "addBot" });
    send(b, { type: "removeSeat", seat: 2 });
    expect(b.errors()).toEqual(["Only the host can remove other seats."]);
    send(b, { type: "removeSeat", seat: 1 });
    send(tv, { type: "removeSeat", seat: 1 });
    const l = tv.last();
    if (l.type !== "lobby") throw new Error();
    expect(l.seats.map((s) => s.name)).toEqual(["A"]);
    expect(l.canStart).toBe(false);
  });
});

describe("Room game", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /**
   * Plays whole games: three phones, one bot, and the TV watching. Every message
   * any client receives is checked: while a round is being bid, it must not
   * contain a single card from anyone else's hand.
   */
  it("plays full games to the end and never leaks another player's hand before the reveal", () => {
    const { room, send } = setup(7);
    const tv = fake("tv", true);
    const phones = [fake("p0"), fake("p1"), fake("p2")];
    room.connect(tv);
    for (const [i, p] of phones.entries()) {
      room.connect(p);
      send(p, { type: "join", name: `P${i}` });
    }
    send(tv, { type: "addBot" });
    send(tv, { type: "setSettings", settings: { cardCap: 4, botSpeed: "instant" } });

    const watchers = [tv, ...phones];
    const seen = new Map<string, number>(watchers.map((c) => [c.id, 0]));
    // Per client, the bidding-phase messages of the round in progress, as JSON.
    const roundLog = new Map<string, string[]>(watchers.map((c) => [c.id, []]));
    let reveals = 0;
    let games = 0;

    function audit(): void {
      for (const c of watchers) {
        const fresh = c.inbox.slice(seen.get(c.id));
        seen.set(c.id, c.inbox.length);
        for (const m of fresh) {
          if (m.type !== "view") continue;
          const g: GameState = m.game;
          const mine = m.me.seat;
          if (g.phase === "bidding") {
            for (const p of g.players) {
              if (p.id === mine) expect(p.hand).toHaveLength(p.eliminated ? 0 : p.cardCount);
              else expect(p.hand).toEqual([]);
            }
            roundLog.get(c.id)!.push(JSON.stringify(m));
          } else if (g.phase === "reveal" || g.phase === "over") {
            // Now the truth is out: none of the others' cards may have appeared earlier this round.
            const others = g.players.filter((p) => p.id !== mine).flatMap((p) => p.hand.map((card) => card.id));
            for (const json of roundLog.get(c.id)!) {
              for (const id of others) expect(json).not.toContain(`"id":"${id}"`);
            }
            roundLog.set(c.id, []);
          }
        }
      }
    }

    send(tv, { type: "start" });
    for (let step = 0; step < 5000 && games < 3; step++) {
      audit();
      const v = tv.lastView();
      const g = v.game;
      if (g.phase === "over") {
        games++;
        expect(g.winner).not.toBeNull();
        send(phones[0]!, { type: "rematch" });
        continue;
      }
      if (g.phase === "reveal") {
        reveals++;
        send(tv, { type: "nextRound" });
        continue;
      }
      const up = phones.find((p) => p.lastView().me.seat === g.turn);
      if (!up) {
        vi.advanceTimersByTime(300); // the bot's turn
        continue;
      }
      const own = up.lastView().game;
      const legal = legalActions(own);
      if (legal.canCallBS && (legal.bids.length === 0 || own.bids.length >= 3)) send(up, { type: "callBS" });
      else send(up, { type: "bid", bid: legal.bids[0]! });
    }
    audit();
    expect(games).toBe(3);
    expect(reveals).toBeGreaterThan(5);
    for (const c of watchers) expect(c.errors()).toEqual([]);
  });

  it("rejects out-of-turn moves, low bids, and joins mid-game", () => {
    const { room, send } = setup(3);
    const a = fake("a");
    const b = fake("b");
    room.connect(a);
    room.connect(b);
    send(a, { type: "join", name: "A" });
    send(b, { type: "join", name: "B" });
    send(a, { type: "start" });
    const g = a.lastView().game;
    const [up, idle] = g.turn === 0 ? [a, b] : [b, a];
    send(idle, { type: "bid", bid: { category: "high", rank: 3 } });
    expect(idle.errors()).toEqual(["It's not your turn."]);
    send(up, { type: "callBS" });
    expect(up.errors()).toEqual(["There's nothing to call yet."]);
    send(up, { type: "bid", bid: { category: "pair", rank: 9 } });
    send(idle, { type: "bid", bid: { category: "pair", rank: 9 } });
    expect(idle.errors()).toContain("That bid has to beat the current one.");
    const late = fake("late");
    room.connect(late);
    send(late, { type: "join", name: "Late" });
    expect(late.errors()).toEqual(["A game is in progress. You can watch until it ends."]);
    expect(late.lastView().game.players.every((p) => p.hand.length === 0)).toBe(true);
    send(late, { type: "nextRound" });
    expect(late.errors()).toContain("There's no round to move on from.");
  });

  it("runs bot turns on the server at the room's bot speed", () => {
    const { room, send } = setup(11);
    const tv = fake("tv", true);
    room.connect(tv);
    send(tv, { type: "addBot" });
    send(tv, { type: "addBot" });
    send(tv, { type: "start" });
    const before = tv.lastView().game.bids.length;
    vi.advanceTimersByTime(650);
    expect(tv.lastView().game.bids.length).toBe(before);
    vi.advanceTimersByTime(600);
    expect(tv.lastView().game.bids.length).toBe(before + 1);
    room.close();
  });
});
