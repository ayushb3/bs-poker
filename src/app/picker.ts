/**
 * Pure helpers for the legal-bid picker. The set of offered bids comes
 * entirely from the engine (legalRaises / legalActions); this file only
 * narrows that list by what the player has tapped so far.
 */
import type { Bid, Category, Rank, Suit } from "../engine";
import { CATEGORIES } from "../engine";
import type { PickerState } from "./state";
import { EMPTY_PICKER } from "./state";

export interface PickerView {
  /** Categories that still have at least one legal raise, in ladder order. */
  readonly categories: readonly Category[];
  /** Primary rank options for the chosen category (empty for flush). */
  readonly ranks: readonly Rank[];
  /** Second rank options (twoPair / fullHouse), given the chosen rank. */
  readonly rank2s: readonly Rank[];
  /** Suit options (flush: all legal suits; straightFlush: suits for the chosen rank). */
  readonly suits: readonly Suit[];
  /** The one legal bid matching every chosen field, if the selection is complete. */
  readonly selected: Bid | null;
}

export function bidRank(bid: Bid): Rank | null {
  return "rank" in bid ? bid.rank : null;
}
export function bidRank2(bid: Bid): Rank | null {
  return "rank2" in bid ? bid.rank2 : null;
}
export function bidSuit(bid: Bid): Suit | null {
  return "suit" in bid ? bid.suit : null;
}

function uniq<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** A picker selection that exactly describes `bid`. */
export function pickerFromBid(bid: Bid): PickerState {
  return { category: bid.category, rank: bidRank(bid), rank2: bidRank2(bid), suit: bidSuit(bid) };
}

/** Lowest legal bid, optionally within a category / rank. Legal bids are ascending. */
export function lowestLegal(
  legal: readonly Bid[],
  category?: Category | null,
  rank?: Rank | null,
): Bid | null {
  for (const b of legal) {
    if (category && b.category !== category) continue;
    if (rank != null && bidRank(b) !== rank) continue;
    return b;
  }
  return null;
}

/** Default selection when it becomes the human's turn: the cheapest raise. */
export function defaultPicker(legal: readonly Bid[]): PickerState {
  const b = lowestLegal(legal);
  return b ? pickerFromBid(b) : EMPTY_PICKER;
}

export function derivePicker(legal: readonly Bid[], p: PickerState): PickerView {
  const present = new Set(legal.map((b) => b.category));
  const categories = CATEGORIES.filter((c) => present.has(c));
  const inCat = p.category ? legal.filter((b) => b.category === p.category) : [];
  const ranks = uniq(inCat.map(bidRank).filter((r): r is Rank => r != null));
  const atRank = p.rank != null ? inCat.filter((b) => bidRank(b) === p.rank) : [];
  const rank2s = uniq(atRank.map(bidRank2).filter((r): r is Rank => r != null));
  const suits =
    p.category === "flush"
      ? uniq(inCat.map(bidSuit).filter((s): s is Suit => s != null))
      : uniq(atRank.map(bidSuit).filter((s): s is Suit => s != null));
  const selected =
    inCat.find(
      (b) =>
        bidRank(b) === p.rank && bidRank2(b) === p.rank2 && bidSuit(b) === p.suit,
    ) ?? null;
  return { categories, ranks, rank2s, suits, selected };
}

/** Choosing a category jumps to the cheapest legal bid in it. */
export function pickCategory(legal: readonly Bid[], category: Category): PickerState {
  const b = lowestLegal(legal, category);
  return b ? pickerFromBid(b) : { ...EMPTY_PICKER, category };
}

/** Choosing a primary rank keeps the category and fills rank2/suit with the cheapest option. */
export function pickRank(legal: readonly Bid[], p: PickerState, rank: Rank): PickerState {
  const b = lowestLegal(legal, p.category, rank);
  return b ? pickerFromBid(b) : { ...p, rank, rank2: null, suit: null };
}

export function pickRank2(p: PickerState, rank2: Rank): PickerState {
  return { ...p, rank2 };
}

export function pickSuit(p: PickerState, suit: Suit): PickerState {
  return { ...p, suit };
}

/**
 * Step the selection along the ladder of legal raises: dir +1 is the next
 * dearer bid, -1 the next cheaper. Clamps at both ends. An incomplete or
 * unknown selection steps from the cheapest raise.
 */
export function stepBid(legal: readonly Bid[], p: PickerState, dir: 1 | -1): Bid | null {
  if (legal.length === 0) return null;
  const selected = derivePicker(legal, p).selected;
  const i = selected ? legal.indexOf(selected) : -1;
  if (i < 0) return legal[0] ?? null;
  return legal[Math.max(0, Math.min(legal.length - 1, i + dir))] ?? null;
}

/** Whether `bid` is one of the legal raises (structural match). */
export function findLegal(legal: readonly Bid[], bid: Bid): Bid | null {
  return derivePicker(legal, pickerFromBid(bid)).selected;
}
