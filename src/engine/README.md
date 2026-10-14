# Engine API (contract)

Pure TypeScript, no DOM, no side effects except via an injected `Rng`.
All of these are exported from `src/engine/index.ts`.

## Cards & deck (`deck.ts`)
- `makeDeck(): Card[]` — 54 cards: 48 naturals (3..A × 4 suits), four 2s, two jokers. Stable ids (`"7h"`, `"2c"`, `"J1"`).
- `shuffle<T>(items: readonly T[], rng: Rng): T[]` — Fisher–Yates, returns a new array.
- `mulberry32(seed: number): Rng` — small seeded PRNG for tests/replays.
- `cardLabel(card): string` — e.g. `"7♥"`, `"2♣ (wild)"`, `"Joker"`.

## Bids (`bids.ts`)
- `compare(a: Bid, b: Bid): number` — the single owner of the ladder. Negative when a < b.
  Category order: high < pair < straight < trips < twoPair < flush < fullHouse < quads < straightFlush < fiveOfAKind.
  Within a category: by `rank`, then `rank2`; flush by suit; straightFlush by rank then suit.
- `allBids(): readonly Bid[]` — every legal bid, ascending, deduplicated. (Straights/straight flushes have h = 7..14; twoPair has rank > rank2; fullHouse rank !== rank2.)
- `legalRaises(current: Bid | null): readonly Bid[]` — bids strictly above `current` (all bids when null).
- `bidsEqual(a, b): boolean`, `bidKey(bid): string` (stable string id, e.g. `"fullHouse:13:4"`), `parseBidKey(key): Bid`.
- `bidLabel(bid): string` — e.g. `"Pair of 7s"`, `"Straight to J"`, `"Two pair, As over 9s"`, `"Flush in ♥"`, `"Full house, Ks over 4s"`, `"Straight flush to 9 in ♠"`, `"Five of a kind, Qs"`, `"High card A"`.
- `rankLabel(rank): string` (`"J"`, `"10"`), `suitSymbol(suit): string`.

## Existence (`exists.ts`)
- `exists(bid: Bid, pool: readonly Card[]): boolean` — per SPEC "Engine": W = wild count, a bid exists if missing cards ≤ W.
- `explain(bid: Bid, pool: readonly Card[]): Explanation` — same answer as `exists`, plus the witness cards for the reveal screen.

## Odds (`odds.ts`)
- `estimateExists(bid: Bid, opts: { known?: readonly Card[]; poolSize: number; trials?: number; rng?: Rng }): number`
  — Monte Carlo P(bid exists) in a pool of `poolSize` cards where `known` cards are certainly in the pool and the rest are drawn uniformly from the remaining deck. Used by the CPU and the "what were the odds" line.

## Game loop (`game.ts`)
- `newGame(config: Partial<GameConfig>, rng: Rng): GameState` — validates config (playerCount 2..6, cardCap 4..8), deals round 1, random starter.
- `legalActions(state): { bids: readonly Bid[]; canCallBS: boolean }` — bids above the current bid; BS only allowed once there is a bid.
- `applyAction(state, action): GameState` — pure; throws `Error` on illegal actions. A `callBS` moves to phase `"reveal"` with `lastResult` set and loser's `cardCount` incremented; a player whose `cardCount` reaches `cardCap` is eliminated. If one player remains, phase becomes `"over"` with `winner`.
- `nextRound(state, rng): GameState` — from `"reveal"`, deals the next round: the loser starts (if the loser was eliminated, the next active player clockwise from them), turn = starter.
- `poolOf(state): Card[]` — all hands concatenated.
- `activePlayers(state): number[]`.
