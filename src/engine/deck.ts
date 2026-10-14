/**
 * Cards, the 54-card deck, shuffling and a tiny seeded PRNG.
 * Pure: the only randomness comes from an injected `Rng`.
 */
import { RANKS, SUITS, type Card, type Rank, type Rng, type Suit } from "./types";

const RANK_LABELS: Readonly<Record<Rank, string>> = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = { c: "♣", d: "♦", h: "♥", s: "♠" };

/** 10 → "10", 11 → "J", 12 → "Q", 13 → "K", 14 → "A". */
export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

/** "c" → "♣", "d" → "♦", "h" → "♥", "s" → "♠". */
export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

/**
 * The full 54-card deck in a fixed, stable order:
 * 48 naturals (rank-major, suit-minor), then the four 2s, then the two jokers.
 * Ids: `"7h"`, `"10c"`, `"Jd"`, `"2c"`, `"J1"` (joker 1), `"J2"` (joker 2).
 */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ id: `${rankLabel(rank)}${suit}`, kind: "natural", rank, suit });
    }
  }
  for (const suit of SUITS) {
    deck.push({ id: `2${suit}`, kind: "two", suit });
  }
  deck.push({ id: "J1", kind: "joker", index: 1 });
  deck.push({ id: "J2", kind: "joker", index: 2 });
  return deck;
}

/** Fisher–Yates shuffle. Returns a new array; the input is not touched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** mulberry32: a small, fast 32-bit seeded PRNG. Good enough for games and tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `"7♥"`, `"2♣ (wild)"`, `"Joker"`. */
export function cardLabel(card: Card): string {
  switch (card.kind) {
    case "natural":
      return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
    case "two":
      return `2${suitSymbol(card.suit)} (wild)`;
    case "joker":
      return "Joker";
  }
}
