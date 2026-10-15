/**
 * Hard's read of the table: earlier bids are weak evidence about other players' hands.
 *
 * A bid that names ranks or a suit is turned into a `Prior`: "with probability w, one
 * natural matching this bid is in the unseen part of the pool". The sampler then forces
 * such a card into the sample with that probability before drawing the rest uniformly.
 * The bot's own bids carry no information it does not already have, so they are skipped.
 *
 * Weights are deliberately modest (SPEC: "weak evidence"): bidders bluff, and a bid such
 * as "pair of 7s" is often made on a single 7 or on nothing. Secondary ranks (the pair in
 * a full house, the lower pair of two pair) and straights are weaker still.
 */
import { makeDeck } from "../engine/deck";
import type { Bid, BidRecord, Card, Rank, Suit } from "../engine/types";
import type { Prior } from "./sampler";

type Natural = Extract<Card, { kind: "natural" }>;
const NATURALS: readonly Natural[] = makeDeck().filter((c): c is Natural => c.kind === "natural");

const ofRank = (rank: Rank): Natural[] => NATURALS.filter((c) => c.rank === rank);
const ofSuit = (suit: Suit): Natural[] => NATURALS.filter((c) => c.suit === suit);
const inWindow = (high: Rank, suit: Suit | null): Natural[] =>
  NATURALS.filter((c) => c.rank >= high - 4 && c.rank <= high && (suit === null || c.suit === suit));

/** Priors implied by one bid at base weight `w`. */
export function priorsForBid(bid: Bid, w: number): Prior[] {
  switch (bid.category) {
    case "high":
    case "pair":
    case "trips":
    case "quads":
    case "fiveOfAKind":
      return [{ candidates: ofRank(bid.rank), prob: w }];
    case "twoPair":
    case "fullHouse":
      return [
        { candidates: ofRank(bid.rank), prob: w },
        { candidates: ofRank(bid.rank2), prob: w * 0.7 },
      ];
    case "straight":
      return [{ candidates: inWindow(bid.rank, null), prob: w * 0.7 }];
    case "flush":
      return [{ candidates: ofSuit(bid.suit), prob: w }];
    case "straightFlush":
      return [{ candidates: inWindow(bid.rank, bid.suit), prob: w }];
  }
}

/** Priors from every bid this round made by someone other than `me`. */
export function evidenceFromBids(bids: readonly BidRecord[], me: number, w: number): Prior[] {
  if (w <= 0) return [];
  const out: Prior[] = [];
  for (const record of bids) {
    if (record.player === me) continue;
    out.push(...priorsForBid(record.bid, w));
  }
  return out;
}
