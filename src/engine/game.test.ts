import { describe, expect, it } from "vitest";
import { allBids, legalRaises } from "./bids";
import { makeDeck, mulberry32 } from "./deck";
import { exists } from "./exists";
import { activePlayers, applyAction, legalActions, newGame, nextRound, poolOf } from "./game";
import { isWild, type Bid, type GameState, type Rng } from "./types";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** A fresh game whose state objects are all frozen, so any mutation throws. */
function game(config: Parameters<typeof newGame>[0], rng: Rng): GameState {
  return deepFreeze(newGame(config, rng));
}

const lowest = allBids()[0] as Bid;
const highest = allBids()[allBids().length - 1] as Bid;

/** Play one round: `bidder` opens with `bid`, the next player calls BS. Returns the reveal state. */
function playRound(state: GameState, bid: Bid): GameState {
  const afterBid = deepFreeze(applyAction(state, { type: "bid", bid }));
  return deepFreeze(applyAction(afterBid, { type: "callBS" }));
}

describe("newGame", () => {
  it("deals startingCards to each player from one 54-card deck", () => {
    const s = game({ playerCount: 4, startingCards: 2 }, mulberry32(1));
    expect(s.players.length).toBe(4);
    expect(s.players.map((p) => p.id)).toEqual([0, 1, 2, 3]);
    for (const p of s.players) {
      expect(p.hand.length).toBe(2);
      expect(p.cardCount).toBe(2);
      expect(p.eliminated).toBe(false);
    }
    const pool = poolOf(s);
    expect(pool.length).toBe(8);
    expect(new Set(pool.map((c) => c.id)).size).toBe(8);
    const deckIds = new Set(makeDeck().map((c) => c.id));
    for (const c of pool) expect(deckIds.has(c.id)).toBe(true);
    expect(s.round).toBe(1);
    expect(s.phase).toBe("bidding");
    expect(s.bids).toEqual([]);
    expect(s.lastResult).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.turn).toBe(s.starter);
    expect(s.config).toEqual({ playerCount: 4, cardCap: 6, startingCards: 2 });
  });

  it("picks a random starter from the rng (different seeds give different starters)", () => {
    const starters = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame({ playerCount: 6 }, mulberry32(seed));
      expect(s.starter).toBeGreaterThanOrEqual(0);
      expect(s.starter).toBeLessThan(6);
      starters.add(s.starter);
    }
    expect(starters.size).toBeGreaterThan(1);
  });

  it("is deterministic for a given seed", () => {
    const a = newGame({ playerCount: 3 }, mulberry32(77));
    const b = newGame({ playerCount: 3 }, mulberry32(77));
    expect(a).toEqual(b);
  });

  it("validates the config", () => {
    expect(() => newGame({ playerCount: 1 }, mulberry32(1))).toThrow();
    expect(() => newGame({ playerCount: 7 }, mulberry32(1))).toThrow();
    expect(() => newGame({ playerCount: 2.5 }, mulberry32(1))).toThrow();
    expect(() => newGame({ cardCap: 3 }, mulberry32(1))).toThrow();
    expect(() => newGame({ cardCap: 9 }, mulberry32(1))).toThrow();
    expect(() => newGame({ startingCards: 0 }, mulberry32(1))).toThrow();
    expect(() => newGame({ startingCards: 6, cardCap: 6 }, mulberry32(1))).toThrow();
    expect(newGame({ playerCount: 6, cardCap: 8, startingCards: 7 }, mulberry32(1)).players.length).toBe(6);
    expect(newGame({}, mulberry32(1)).config.playerCount).toBe(4);
  });
});

describe("bidding", () => {
  it("legalActions offers every bid and no BS before the first bid", () => {
    const s = game({ playerCount: 3 }, mulberry32(2));
    const la = legalActions(s);
    expect(la.bids).toEqual(allBids());
    expect(la.canCallBS).toBe(false);
  });

  it("rotates clockwise by seat and only offers raises", () => {
    let s = game({ playerCount: 3 }, mulberry32(2));
    const starter = s.starter;
    const bids = allBids();
    s = deepFreeze(applyAction(s, { type: "bid", bid: bids[10] as Bid }));
    expect(s.bids).toEqual([{ player: starter, bid: bids[10] }]);
    expect(s.turn).toBe((starter + 1) % 3);
    const la = legalActions(s);
    expect(la.bids).toEqual(legalRaises(bids[10] as Bid));
    expect(la.canCallBS).toBe(true);
    s = deepFreeze(applyAction(s, { type: "bid", bid: bids[11] as Bid }));
    expect(s.turn).toBe((starter + 2) % 3);
    s = deepFreeze(applyAction(s, { type: "bid", bid: bids[50] as Bid }));
    expect(s.turn).toBe(starter);
    expect(s.bids.map((b) => b.player)).toEqual([starter, (starter + 1) % 3, (starter + 2) % 3]);
  });

  it("rejects non-raises, equal bids, malformed bids, and BS with no bid", () => {
    const s = game({ playerCount: 3 }, mulberry32(3));
    expect(() => applyAction(s, { type: "callBS" })).toThrow();
    const bids = allBids();
    const s1 = deepFreeze(applyAction(s, { type: "bid", bid: bids[20] as Bid }));
    expect(() => applyAction(s1, { type: "bid", bid: bids[20] as Bid })).toThrow();
    expect(() => applyAction(s1, { type: "bid", bid: bids[19] as Bid })).toThrow();
    expect(() => applyAction(s1, { type: "bid", bid: lowest })).toThrow();
    expect(() => applyAction(s1, { type: "bid", bid: { category: "straight", rank: 6 } })).toThrow();
    expect(() => applyAction(s1, { type: "bid", bid: { category: "twoPair", rank: 3, rank2: 9 } })).toThrow();
    expect(applyAction(s1, { type: "bid", bid: bids[21] as Bid }).bids.length).toBe(2);
  });

  it("rejects actions outside the bidding phase", () => {
    const s = game({ playerCount: 3 }, mulberry32(4));
    const reveal = playRound(s, lowest);
    expect(reveal.phase).toBe("reveal");
    expect(() => applyAction(reveal, { type: "callBS" })).toThrow();
    expect(() => applyAction(reveal, { type: "bid", bid: highest })).toThrow();
    expect(legalActions(reveal)).toEqual({ bids: [], canCallBS: false });
    expect(() => nextRound(s, mulberry32(1))).toThrow();
  });
});

describe("calling BS", () => {
  it("the caller loses when the bid exists", () => {
    const s = game({ playerCount: 3 }, mulberry32(5));
    // "High card 3" exists if the pool has a 3 or any wild; find a seed/bid that exists.
    const pool = poolOf(s);
    const existing = allBids().find((b) => exists(b, pool)) as Bid;
    const r = playRound(s, existing);
    expect(r.phase).toBe("reveal");
    const result = r.lastResult;
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.round).toBe(1);
    expect(result.bidder).toBe(s.starter);
    expect(result.caller).toBe((s.starter + 1) % 3);
    expect(result.bid).toEqual(existing);
    expect(result.existed).toBe(true);
    expect(result.loser).toBe(result.caller);
    expect(result.explanation.exists).toBe(true);
    expect(result.pool.map((c) => c.id)).toEqual(pool.map((c) => c.id));
    expect(result.eliminated).toEqual([]);
    expect(r.players[result.loser]?.cardCount).toBe(3);
    expect(r.players[result.bidder]?.cardCount).toBe(2);
    expect(r.winner).toBeNull();
  });

  it("the bidder loses when the bid does not exist", () => {
    const s = game({ playerCount: 3 }, mulberry32(6));
    // Five of a kind of Aces can't exist in a 6-card pool with fewer than 5 wilds/aces; pick a seed where it doesn't.
    expect(exists(highest, poolOf(s))).toBe(false);
    const r = playRound(s, highest);
    const result = r.lastResult;
    if (!result) throw new Error("no result");
    expect(result.existed).toBe(false);
    expect(result.loser).toBe(s.starter);
    expect(r.players[s.starter]?.cardCount).toBe(3);
    expect(result.explanation.shortBy).toBeGreaterThan(0);
  });
});

describe("rounds and elimination", () => {
  it("the loser starts the next round and everyone is re-dealt their cardCount", () => {
    const s = game({ playerCount: 4 }, mulberry32(8));
    const r = playRound(s, highest); // bidder (starter) loses
    const loser = r.lastResult?.loser as number;
    expect(loser).toBe(s.starter);
    const n = deepFreeze(nextRound(r, mulberry32(9)));
    expect(n.round).toBe(2);
    expect(n.phase).toBe("bidding");
    expect(n.starter).toBe(loser);
    expect(n.turn).toBe(loser);
    expect(n.bids).toEqual([]);
    expect(n.lastResult).toBeNull();
    for (const p of n.players) expect(p.hand.length).toBe(p.cardCount);
    expect(n.players[loser]?.hand.length).toBe(3);
    expect(poolOf(n).length).toBe(9);
    expect(new Set(poolOf(n).map((c) => c.id)).size).toBe(9);
  });

  it("eliminates a player who reaches the cap, empties their hand, and skips them in rotation", () => {
    // 3 players, cap 4, starting 3: one lost round eliminates.
    let s = game({ playerCount: 3, cardCap: 4, startingCards: 3 }, mulberry32(10));
    const victim = s.starter;
    s = playRound(s, highest);
    expect(s.phase).toBe("reveal");
    expect(s.lastResult?.loser).toBe(victim);
    expect(s.lastResult?.eliminated).toEqual([victim]);
    expect(s.players[victim]?.eliminated).toBe(true);
    expect(s.players[victim]?.cardCount).toBe(4);
    expect(s.players[victim]?.hand).toEqual([]);
    expect(activePlayers(s)).toEqual([0, 1, 2].filter((id) => id !== victim));
    // The pool at reveal still shows the eliminated player's cards.
    expect(s.lastResult?.pool.length).toBe(9);

    // Next round: loser was eliminated, so the next active player clockwise starts.
    s = deepFreeze(nextRound(s, mulberry32(11)));
    expect(s.round).toBe(2);
    expect(s.starter).toBe((victim + 1) % 3);
    expect(s.players[victim]?.hand).toEqual([]);
    expect(poolOf(s).length).toBe(6);

    // Rotation skips the eliminated seat.
    const a = s.starter;
    const b = (victim + 2) % 3;
    s = deepFreeze(applyAction(s, { type: "bid", bid: lowest }));
    expect(s.turn).toBe(b);
    s = deepFreeze(applyAction(s, { type: "bid", bid: allBids()[1] as Bid }));
    expect(s.turn).toBe(a);
    s = deepFreeze(applyAction(s, { type: "bid", bid: allBids()[2] as Bid }));
    expect(s.turn).toBe(b);
  });

  it("skips an eliminated seat when it sits between the loser and the next starter", () => {
    // 4 players, cap 4, starting 3. Eliminate seat (starter) in round 1, then make the player
    // before it lose round 2 while bidding... simpler: eliminate two players and check the wrap.
    let s = game({ playerCount: 4, cardCap: 4, startingCards: 3 }, mulberry32(12));
    const first = s.starter;
    s = playRound(s, highest); // `first` eliminated
    s = deepFreeze(nextRound(s, mulberry32(13)));
    expect(s.starter).toBe((first + 1) % 4);
    // Make the starter of round 2 lose too: it is the seat after `first`.
    const second = s.starter;
    s = playRound(s, highest);
    expect(s.lastResult?.eliminated).toEqual([second]);
    expect(s.phase).toBe("reveal");
    s = deepFreeze(nextRound(s, mulberry32(14)));
    // Next active clockwise from `second`, skipping nothing between (first is before second).
    expect(s.starter).toBe((second + 1) % 4);
    expect(activePlayers(s).length).toBe(2);
    // One more loss ends the game: the winner is the only remaining player.
    const third = s.starter;
    s = playRound(s, highest);
    expect(s.phase).toBe("over");
    expect(s.lastResult?.eliminated).toEqual([third]);
    expect(s.winner).toBe(activePlayers(s)[0]);
    expect(activePlayers(s).length).toBe(1);
    expect(() => nextRound(s, mulberry32(1))).toThrow();
    expect(() => applyAction(s, { type: "callBS" })).toThrow();
  });

  it("a full random game always terminates with one winner", () => {
    for (let seed = 100; seed < 110; seed++) {
      const rng = mulberry32(seed);
      let s = game({ playerCount: 2 + (seed % 5), cardCap: 4 + (seed % 5) }, rng);
      let rounds = 0;
      while (s.phase !== "over") {
        if (s.phase === "reveal") {
          s = deepFreeze(nextRound(s, rng));
          continue;
        }
        const la = legalActions(s);
        // Raise a few times, then call BS.
        if (!la.canCallBS || (s.bids.length < 3 && la.bids.length > 0 && rng() < 0.7)) {
          const pick = la.bids[Math.floor(rng() * Math.min(la.bids.length, 40))] as Bid;
          s = deepFreeze(applyAction(s, { type: "bid", bid: pick }));
        } else {
          s = deepFreeze(applyAction(s, { type: "callBS" }));
          rounds++;
        }
        expect(rounds).toBeLessThan(200);
      }
      expect(s.winner).not.toBeNull();
      expect(s.players.filter((p) => !p.eliminated).map((p) => p.id)).toEqual([s.winner]);
      for (const p of s.players) {
        if (p.eliminated) expect(p.cardCount).toBeGreaterThanOrEqual(s.config.cardCap);
        else expect(p.cardCount).toBeLessThan(s.config.cardCap);
      }
    }
  });
});

describe("immutability", () => {
  it("applyAction and nextRound never mutate their input", () => {
    const s = game({ playerCount: 3 }, mulberry32(20));
    const snapshot = JSON.stringify(s);
    const s1 = applyAction(s, { type: "bid", bid: lowest });
    expect(JSON.stringify(s)).toBe(snapshot);
    const snap1 = JSON.stringify(s1);
    const s2 = applyAction(s1, { type: "callBS" });
    expect(JSON.stringify(s1)).toBe(snap1);
    const snap2 = JSON.stringify(s2);
    nextRound(s2, mulberry32(21));
    expect(JSON.stringify(s2)).toBe(snap2);
    expect(s1).not.toBe(s);
    expect(s1.players).toBe(s.players); // untouched sub-objects may be shared
  });

  it("poolOf returns a fresh array and handles wilds", () => {
    const s = game({ playerCount: 6, startingCards: 5, cardCap: 8 }, mulberry32(30));
    const pool = poolOf(s);
    expect(pool.length).toBe(30);
    expect(pool).not.toBe(poolOf(s));
    expect(pool.filter(isWild).length).toBeLessThanOrEqual(6);
  });
});
