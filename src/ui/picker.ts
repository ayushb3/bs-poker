/**
 * The bottom HUD on your turn: ‹ [Raise · next legal bid] › on a parchment
 * brush, "Change hand" and a red "Call BS". The arrows walk the engine's
 * ladder of legal raises; the Change hand sheet jumps by hand type, rank and
 * suit. Every option comes from legalActions; nothing here decides legality.
 */
import type { Category, GameState } from "../engine";
import { bidLabel, legalActions, rankLabel, suitSymbol } from "../engine";
import type { Actions } from "../app/controller";
import type { AppState } from "../app/state";
import { derivePicker, stepBid } from "../app/picker";
import { h, button } from "./dom";
import { getLocal, setLocal } from "./local";

const CATEGORY_NAME: Record<Category, string> = {
  high: "High card",
  pair: "Pair",
  straight: "Straight",
  trips: "Three of a kind",
  twoPair: "Two pair",
  flush: "Flush",
  fullHouse: "Full house",
  quads: "Four of a kind",
  straightFlush: "Straight flush",
  fiveOfAKind: "Five of a kind",
};

const SUIT_NAME = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const;

export function bidHud(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const { bids, canCallBS } = legalActions(game);
  const view = derivePicker(bids, state.picker);
  const selected = view.selected;
  const verb = game.bids.length > 0 ? "Raise" : "Open";
  const idx = selected ? bids.indexOf(selected) : -1;
  const lower = stepBid(bids, state.picker, -1);
  const higher = stepBid(bids, state.picker, 1);

  return h(
    "div",
    { class: "hud hud-turn", role: "group", "aria-label": "Your move" },
    h(
      "div",
      { class: "hud-row raise-row" },
      button("‹", () => actions.stepBid(-1), {
        class: "arrow",
        key: "lower",
        ariaLabel: lower && idx > 0 ? `Lower raise: ${bidLabel(lower)}` : "Lower raise",
        disabled: idx <= 0,
      }),
      button(
        [verb, h("span", { class: "dot" }, " · "), selected ? bidLabel(selected) : "Pick a hand"],
        () => actions.confirmBid(),
        { class: "brush parchment raise", key: "confirm", disabled: !selected },
      ),
      button("›", () => actions.stepBid(1), {
        class: "arrow",
        key: "higher",
        ariaLabel: higher && idx < bids.length - 1 ? `Higher raise: ${bidLabel(higher)}` : "Higher raise",
        disabled: idx < 0 || idx >= bids.length - 1,
      }),
    ),
    h(
      "div",
      { class: "hud-row" },
      button("Change hand", () => setLocal({ sheet: true }), { class: "text-btn", key: "change" }),
      button("Call BS", () => actions.callBS(), {
        class: "brush blood callbs",
        key: "callbs",
        disabled: !canCallBS,
        ariaLabel: canCallBS ? "Call BS on the current claim" : "Call BS (nothing claimed yet)",
      }),
    ),
  );
}

function chipRow(label: string, chips: HTMLElement[]): HTMLElement | null {
  if (chips.length === 0) return null;
  return h("div", { class: "sheet-row" }, h("span", { class: "sheet-lbl" }, label), h("div", { class: "chips" }, chips));
}

/** The "Change hand" sheet. */
export function changeHandSheet(state: AppState, game: GameState, actions: Actions): HTMLElement | null {
  if (!getLocal().sheet) return null;
  const { bids } = legalActions(game);
  const view = derivePicker(bids, state.picker);
  const p = state.picker;
  const close = (): void => setLocal({ sheet: false });
  const cat = p.category;

  const cats = view.categories.map((c) =>
    button(CATEGORY_NAME[c], () => actions.pickCategory(c), {
      class: `cat-btn${cat === c ? " selected" : ""}`,
      key: `cat-${c}`,
      pressed: cat === c,
    }),
  );
  const rankLbl = cat === "straight" || cat === "straightFlush" ? "Up to" : cat === "twoPair" || cat === "fullHouse" ? "Of" : "Rank";
  const ranks = view.ranks.map((r) =>
    button(rankLabel(r), () => actions.pickRank(r), { class: `chip${p.rank === r ? " selected" : ""}`, key: `rank-${r}`, pressed: p.rank === r }),
  );
  const rank2s = view.rank2s.map((r) =>
    button(rankLabel(r), () => actions.pickRank2(r), { class: `chip${p.rank2 === r ? " selected" : ""}`, key: `rank2-${r}`, pressed: p.rank2 === r }),
  );
  const suits = view.suits.map((s) =>
    button(suitSymbol(s), () => actions.pickSuit(s), {
      class: `chip suit suit-${s}${p.suit === s ? " selected" : ""}`,
      key: `suit-${s}`,
      pressed: p.suit === s,
      ariaLabel: SUIT_NAME[s],
    }),
  );

  return h(
    "div",
    { class: "sheet-layer" },
    h("div", { class: "sheet-scrim", onclick: close }),
    h(
      "section",
      { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Change hand" },
      h("div", { class: "sheet-head" }, h("h2", null, "Change hand"), button("Done", close, { class: "text-btn small", key: "sheet-done" })),
      h("div", { class: "cat-grid", role: "group", "aria-label": "Hand type" }, cats),
      chipRow(rankLbl, ranks),
      chipRow("over", rank2s),
      chipRow("in", suits),
      h(
        "div",
        { class: "sheet-foot" },
        button(
          [game.bids.length > 0 ? "Raise" : "Open", h("span", { class: "dot" }, " · "), view.selected ? bidLabel(view.selected) : "Pick a hand"],
          () => {
            setLocal({ sheet: false });
            actions.confirmBid();
          },
          { class: "brush parchment raise", key: "sheet-confirm", disabled: !view.selected },
        ),
      ),
    ),
  );
}
