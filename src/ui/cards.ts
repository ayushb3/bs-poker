/** Card faces (Fomin English pattern, sepia-graded), the CSS joker, backs and claim fans. */
import type { Bid, Card, Rank, Suit } from "../engine";
import { cardLabel, isWild } from "../engine";
import { ART, faceUrl } from "./assets";
import { h } from "./dom";

export interface CardOpts {
  /** Rendered width in stage px; height follows the 2:3 card ratio. */
  readonly width: number;
  /** Extra classes, e.g. "witness", "dim", "deal". */
  readonly cls?: string;
  /** Inline transform / animation style. */
  readonly style?: string;
  /** Red WILD ribbon across wild cards (your hand only). */
  readonly ribbon?: boolean;
  /** Override the accessible label. */
  readonly label?: string;
}

function jokerFace(): HTMLElement {
  return h(
    "div",
    { class: "joker-face", "aria-hidden": "true" },
    h("span", { class: "jk-corner tl" }, "★"),
    h("span", { class: "jk-star" }, "★"),
    h("span", { class: "jk-word" }, "Joker"),
    h("span", { class: "jk-corner br" }, "★"),
  );
}

/** One face-up card. */
export function cardEl(card: Card, opts: CardOpts): HTMLElement {
  const url = faceUrl(card);
  const cls = ["card", opts.cls ?? ""].filter(Boolean).join(" ");
  const style = `--cw:${opts.width}px;${opts.style ?? ""}`;
  return h(
    "div",
    {
      class: cls,
      style,
      role: "img",
      "aria-label": opts.label ?? cardLabel(card) + (/witness/.test(cls) ? ", part of the hand" : ""),
    },
    url ? h("img", { src: url, alt: "", draggable: "false", decoding: "async" }) : jokerFace(),
    opts.ribbon && isWild(card) ? h("span", { class: "wild-ribbon", "aria-hidden": "true" }, "Wild") : null,
  );
}

/** A face-down card. */
export function cardBackEl(width: number, style = ""): HTMLElement {
  return h("img", {
    class: "card-back",
    src: ART.cardBack,
    alt: "",
    draggable: "false",
    style: `--cw:${width}px;${style}`,
  });
}

/** Fan geometry shared by hands and claims: rotation and drop for card i of n. */
export function fan(i: number, n: number, spread = 6, drop = 1.5): { rot: number; dy: number } {
  const t = i - (n - 1) / 2;
  return { rot: t * spread, dy: t * t * drop };
}

const SUIT_CYCLE: readonly Suit[] = ["s", "h", "c", "d"];

function nat(rank: Rank, suit: Suit, i: number): Card {
  return { id: `claim-${i}`, kind: "natural", rank, suit };
}

function run(high: Rank, suit: (i: number) => Suit): Card[] {
  return [4, 3, 2, 1, 0].map((d, i) => nat((high - d) as Rank, suit(i), i));
}

function kind(rank: Rank, n: number, offset = 0): Card[] {
  return Array.from({ length: n }, (_, i) => nat(rank, SUIT_CYCLE[(i + offset) % 4]!, i + offset));
}

/** Representative cards that picture a bid: "Straight to 9" -> 5 6 7 8 9. Display only. */
export function claimCards(bid: Bid): Card[] {
  switch (bid.category) {
    case "high":
      return kind(bid.rank, 1);
    case "pair":
      return kind(bid.rank, 2);
    case "trips":
      return kind(bid.rank, 3);
    case "quads":
      return kind(bid.rank, 4);
    case "fiveOfAKind":
      return [...kind(bid.rank, 4), { id: "claim-j", kind: "joker", index: 1 }];
    case "twoPair":
      return [...kind(bid.rank, 2), ...kind(bid.rank2, 2, 2)];
    case "fullHouse":
      return [...kind(bid.rank, 3), ...kind(bid.rank2, 2, 3)];
    case "straight":
      return run(bid.rank, (i) => SUIT_CYCLE[(i + 2) % 4]!);
    case "flush":
      return ([14, 11, 8, 6, 4] as Rank[]).map((r, i) => nat(r, bid.suit, i));
    case "straightFlush":
      return run(bid.rank, () => bid.suit);
  }
}
