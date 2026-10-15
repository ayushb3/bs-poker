/** Card faces/backs in the June prototype's cream + Georgia style. */
import type { Card } from "../engine";
import { cardLabel, rankLabel, suitSymbol } from "../engine";
import { h } from "./dom";

export type CardSize = "normal" | "small";

export interface CardOpts {
  readonly size?: CardSize;
  readonly witness?: boolean;
  /** Index for the staggered dealIn animation; omit for no animation. */
  readonly deal?: number;
}

export function cardEl(card: Card, opts: CardOpts = {}): HTMLElement {
  const classes = ["card"];
  if (opts.size === "small") classes.push("small");
  if (opts.witness) classes.push("witness");
  if (opts.deal != null) classes.push("deal");
  const label = cardLabel(card) + (opts.witness ? ", counts toward the hand" : "");
  const style = opts.deal != null ? `animation-delay:${opts.deal * 70}ms` : undefined;

  if (card.kind === "joker") {
    classes.push("wild");
    return h(
      "div",
      { class: classes.join(" "), role: "img", "aria-label": label, style },
      h("div", { class: "rank-tl", "aria-hidden": "true" }, "★"),
      h("div", { class: "pip", "aria-hidden": "true" }, "🃏"),
      h("div", { class: "rank-br", "aria-hidden": "true" }, "★"),
    );
  }
  if (card.kind === "two") {
    classes.push("wild");
    const s = suitSymbol(card.suit);
    return h(
      "div",
      { class: classes.join(" "), role: "img", "aria-label": label, style },
      h("div", { class: "rank-tl", "aria-hidden": "true" }, "★"),
      h("div", { class: "pip", "aria-hidden": "true" }, `2${s}`),
      h("div", { class: "rank-br", "aria-hidden": "true" }, "★"),
    );
  }
  const r = rankLabel(card.rank);
  const s = suitSymbol(card.suit);
  if (card.suit === "h" || card.suit === "d") classes.push("red");
  return h(
    "div",
    { class: classes.join(" "), role: "img", "aria-label": label, style },
    h("div", { class: "rank-tl", "aria-hidden": "true" }, `${r}${s}`),
    h("div", { class: "pip", "aria-hidden": "true" }, s),
    h("div", { class: "rank-br", "aria-hidden": "true" }, `${r}${s}`),
  );
}

export function cardBackEl(size: CardSize = "normal"): HTMLElement {
  return h("div", { class: `card back${size === "small" ? " small" : ""}`, "aria-hidden": "true" });
}

/** The tiny card-back row shown under each opponent. */
export function miniCards(count: number): HTMLElement {
  const el = h("div", { class: "mini-cards", "aria-hidden": "true" });
  for (let i = 0; i < count; i++) el.appendChild(h("span", { class: "mini-card" }));
  return el;
}
