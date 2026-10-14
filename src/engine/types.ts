/**
 * BS Poker engine — shared types (rules v0.3, see docs/SPEC.md).
 *
 * This file is the contract between the engine, the CPU players and the UI.
 * Keep it dependency-free and pure.
 */

/** Natural ranks run 3..A (2s are wild). 11=J, 12=Q, 13=K, 14=A. */
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: readonly Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Suits rank ♣ < ♦ < ♥ < ♠ for tie-breaking flush bids. */
export type Suit = "c" | "d" | "h" | "s";
export const SUITS: readonly Suit[] = ["c", "d", "h", "s"];

/**
 * A card from the 54-card deck. Four 2s and two jokers are wild (6 wilds).
 * - natural: rank 3..14 with a suit
 * - two: wild, keeps its suit for display only
 * - joker: wild, no suit
 */
export type Card =
  | { readonly id: string; readonly kind: "natural"; readonly rank: Rank; readonly suit: Suit }
  | { readonly id: string; readonly kind: "two"; readonly suit: Suit }
  | { readonly id: string; readonly kind: "joker"; readonly index: 1 | 2 };

export function isWild(card: Card): boolean {
  return card.kind !== "natural";
}

/** Ladder order, lowest to highest (decided by simulation; see SPEC §2). */
export const CATEGORIES = [
  "high",
  "pair",
  "straight",
  "trips",
  "twoPair",
  "flush",
  "fullHouse",
  "quads",
  "straightFlush",
  "fiveOfAKind",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * A bid names a specific hand. Shape follows SPEC "Engine": {category, rank, rank2?, suit?}.
 * - high/pair/trips/quads/fiveOfAKind: `rank` is the n-of-a-kind rank.
 * - straight: `rank` is the high card h, 7..14 (lowest straight is 3-4-5-6-7).
 * - twoPair: `rank` > `rank2` (the two pair ranks; always store the higher first).
 * - fullHouse: `rank` is the trips rank, `rank2` the pair rank, rank !== rank2.
 * - flush: `suit` only (no rank).
 * - straightFlush: `rank` is the high card h (7..14) and `suit` the suit.
 */
export type Bid =
  | { readonly category: "high" | "pair" | "trips" | "quads" | "fiveOfAKind"; readonly rank: Rank }
  | { readonly category: "straight"; readonly rank: Rank }
  | { readonly category: "twoPair"; readonly rank: Rank; readonly rank2: Rank }
  | { readonly category: "fullHouse"; readonly rank: Rank; readonly rank2: Rank }
  | { readonly category: "flush"; readonly suit: Suit }
  | { readonly category: "straightFlush"; readonly rank: Rank; readonly suit: Suit };

/** Random number source in [0, 1). Inject for reproducible games/tests. */
export type Rng = () => number;

/**
 * Why a bid exists (or not) in a pool — drives the reveal screen.
 * `cards` are the pool cards that make the hand (naturals that count + wilds consumed).
 * When it does not exist, `cards` are the best partial contributors and `shortBy`
 * is how many more wilds would have been needed.
 */
export interface Explanation {
  readonly exists: boolean;
  readonly cards: readonly Card[];
  readonly wildsUsed: number;
  readonly wildsAvailable: number;
  readonly shortBy: number;
  /** Human-readable, e.g. "Two 7s + 1 wild" or "Only one 7 and no wilds: short by 1". */
  readonly summary: string;
}

export interface GameConfig {
  /** Total players including the human (2..6). */
  readonly playerCount: number;
  /** Reaching this many cards eliminates a player. Default 6, allowed 4..8. */
  readonly cardCap: number;
  /** Cards dealt to everyone in round 1. Default 2. */
  readonly startingCards: number;
}

export const DEFAULT_CONFIG: GameConfig = { playerCount: 4, cardCap: 6, startingCards: 2 };

export interface PlayerState {
  readonly id: number;
  /** How many cards this player is dealt each round (grows by 1 per lost round). */
  readonly cardCount: number;
  readonly eliminated: boolean;
  /** Current round's hand (empty when eliminated). */
  readonly hand: readonly Card[];
}

export interface BidRecord {
  readonly player: number;
  readonly bid: Bid;
}

export interface RoundResult {
  readonly round: number;
  readonly bidder: number;
  readonly caller: number;
  readonly bid: Bid;
  readonly existed: boolean;
  /** Player who takes +1 card: the bidder if the bid was false, else the caller. */
  readonly loser: number;
  readonly explanation: Explanation;
  /** The full pool at reveal time. */
  readonly pool: readonly Card[];
  /** Players eliminated as a result of this round. */
  readonly eliminated: readonly number[];
}

export type Phase = "bidding" | "reveal" | "over";

export interface GameState {
  readonly config: GameConfig;
  readonly players: readonly PlayerState[];
  readonly round: number;
  /** Player who opened this round. */
  readonly starter: number;
  /** Player whose turn it is (bidding phase). */
  readonly turn: number;
  readonly bids: readonly BidRecord[];
  readonly phase: Phase;
  /** Set during "reveal" and "over" (the last round's outcome). */
  readonly lastResult: RoundResult | null;
  /** Set when phase === "over". */
  readonly winner: number | null;
}

export type Action = { readonly type: "bid"; readonly bid: Bid } | { readonly type: "callBS" };
