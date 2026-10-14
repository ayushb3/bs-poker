/**
 * Legal-bid picker. Every option shown comes from the engine's legal raises;
 * this file never decides what a legal bid is.
 */
import type { Bid, Category } from "../engine";
import { bidLabel, legalActions, rankLabel, suitSymbol } from "../engine";
import type { Actions } from "../app/controller";
import type { AppState } from "../app/state";
import { derivePicker } from "../app/picker";
import type { GameState } from "../engine";
import { h, button } from "./dom";

const CATEGORY_SHORT: Record<Category, string> = {
  high: "High card",
  pair: "Pair",
  straight: "Straight",
  trips: "Trips",
  twoPair: "Two pair",
  flush: "Flush",
  fullHouse: "Full house",
  quads: "Quads",
  straightFlush: "Str. flush",
  fiveOfAKind: "5 of a kind",
};

const SUIT_NAME = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const;

export function bidPicker(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const { bids, canCallBS } = legalActions(game);
  const view = derivePicker(bids, state.picker);
  const p = state.picker;
  const current: Bid | null = game.bids[game.bids.length - 1]?.bid ?? null;

  const rows: HTMLElement[] = [];
  rows.push(
    h(
      "div",
      { class: "picker-row" },
      h("span", { class: "lbl" }, current ? "Raise to" : "Open with"),
      h(
        "div",
        { class: "chips", role: "group", "aria-label": "Hand category" },
        view.categories.map((c) =>
          button(CATEGORY_SHORT[c], () => actions.pickCategory(c), {
            class: `chip cat${p.category === c ? " selected" : ""}`,
            key: `cat-${c}`,
            pressed: p.category === c,
          }),
        ),
      ),
    ),
  );

  if (p.category && view.ranks.length > 0) {
    const lbl = p.category === "straight" || p.category === "straightFlush" ? "Up to" : "Rank";
    rows.push(
      h(
        "div",
        { class: "picker-row" },
        h("span", { class: "lbl" }, lbl),
        h(
          "div",
          { class: "chips", role: "group", "aria-label": "Rank" },
          view.ranks.map((r) =>
            button(rankLabel(r), () => actions.pickRank(r), {
              class: `chip rank${p.rank === r ? " selected" : ""}`,
              key: `rank-${r}`,
              pressed: p.rank === r,
            }),
          ),
        ),
      ),
    );
  }
  if (p.category && view.rank2s.length > 0) {
    rows.push(
      h(
        "div",
        { class: "picker-row" },
        h("span", { class: "lbl" }, "over"),
        h(
          "div",
          { class: "chips", role: "group", "aria-label": "Second rank" },
          view.rank2s.map((r) =>
            button(rankLabel(r), () => actions.pickRank2(r), {
              class: `chip rank${p.rank2 === r ? " selected" : ""}`,
              key: `rank2-${r}`,
              pressed: p.rank2 === r,
            }),
          ),
        ),
      ),
    );
  }
  if (p.category && view.suits.length > 0) {
    rows.push(
      h(
        "div",
        { class: "picker-row" },
        h("span", { class: "lbl" }, "in"),
        h(
          "div",
          { class: "chips", role: "group", "aria-label": "Suit" },
          view.suits.map((s) =>
            button(suitSymbol(s), () => actions.pickSuit(s), {
              class: `chip suit suit-${s}${p.suit === s ? " selected" : ""}`,
              key: `suit-${s}`,
              pressed: p.suit === s,
              ariaLabel: SUIT_NAME[s],
            }),
          ),
        ),
      ),
    );
  }

  const confirmLabel = view.selected ? `Bid: ${bidLabel(view.selected)}` : "Pick a hand";
  rows.push(
    h(
      "div",
      { class: "picker-actions" },
      button(confirmLabel, () => actions.confirmBid(), {
        class: "confirm bid-btn",
        disabled: !view.selected,
        key: "confirm",
      }),
      button("Call BS!", () => actions.callBS(), {
        class: "bs",
        disabled: !canCallBS,
        key: "callbs",
        ariaLabel: canCallBS ? "Call BS on the current bid" : "Call BS (no bid yet)",
      }),
    ),
  );

  return h("section", { class: "picker", "aria-label": "Your move" }, rows);
}
