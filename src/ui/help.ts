/** "How to play" panel summarising rules v0.3 (docs/SPEC.md). */
import { h, button } from "./dom";

const LADDER: readonly [string, string][] = [
  ["High card", "e.g. High card K"],
  ["Pair", "Pair of 7s"],
  ["Straight", "Straight to J (five in a row)"],
  ["Trips", "Three 9s"],
  ["Two pair", "As over 9s"],
  ["Flush", "Flush in ♥ (five of a suit, any ranks)"],
  ["Full house", "Ks over 4s"],
  ["Quads", "Four 10s"],
  ["Straight flush", "Straight flush to 9 in ♠"],
  ["Five of a kind", "Five Qs"],
];

export function helpPanel(onClose: () => void): HTMLElement {
  return h(
    "div",
    { class: "overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "help-title" },
    h(
      "div",
      { class: "help-box" },
      h("h2", { id: "help-title" }, "How to play"),
      h(
        "p",
        null,
        "Everyone is dealt a few cards. All hands together form one hidden ",
        h("b", null, "pool"),
        ". On your turn, bid a poker hand you think exists somewhere in the pool, or call ",
        h("b", null, "BS"),
        " on the last bid.",
      ),
      h("h3", null, "The ladder, lowest to highest"),
      h(
        "ol",
        { class: "ladder" },
        LADDER.map(([name, ex]) => h("li", null, h("span", { class: "h" }, name), h("span", { class: "p" }, ex))),
      ),
      h("h3", null, "Bidding"),
      h(
        "ul",
        null,
        h("li", null, "Bids name ranks: “pair of 7s”, not just “a pair”. A raise is a higher category, or the same category with a higher rank."),
        h("li", null, "Flushes name a suit only (“flush in ♥”). Suits rank ♣ < ♦ < ♥ < ♠."),
        h("li", null, "Six wilds: all four 2s and both jokers. Natural ranks run 3 through A, so the lowest straight is 3-4-5-6-7."),
        h("li", null, "Impossible bids are allowed (desperation bluffs); BS on one always wins."),
      ),
      h("h3", null, "Calling BS"),
      h(
        "ul",
        null,
        h("li", null, "Everyone shows their cards. If the hand is in the pool, the caller loses; if not, the bidder loses."),
        h("li", null, "The loser takes +1 card for every round after. The loser also opens the next round."),
        h("li", null, "On the reveal, gold cards are the ones that make the claimed hand."),
        h("li", null, "Reach the card cap and you're out. Last player standing wins."),
      ),
      h("div", { class: "close-row" }, button("Got it", onClose, { class: "brush parchment", key: "help-close" })),
    ),
  );
}
