/** Title: the painting, the wordmark, ‹ value › settings rows and "Take a seat". */
import type { Actions } from "../app/controller";
import type { AppState } from "../app/state";
import { MAX_BOTS, MAX_CAP, MIN_BOTS, MIN_CAP } from "../app/state";
import { DIFFICULTIES } from "../cpu";
import { backdropEl } from "./scene";
import { h, button } from "./dom";

interface Stepper {
  readonly label: string;
  readonly value: string;
  readonly prev: string;
  readonly next: string;
  readonly key: string;
  readonly onPrev: (() => void) | null;
  readonly onNext: (() => void) | null;
}

function stepperRow(s: Stepper): HTMLElement {
  return h(
    "div",
    { class: "setting-row", role: "group", "aria-label": s.label },
    h("span", { class: "setting-lbl" }, s.label),
    h(
      "div",
      { class: "stepper" },
      button("‹", () => s.onPrev?.(), { class: "arrow", key: `${s.key}-prev`, ariaLabel: s.prev, disabled: !s.onPrev }),
      h("span", { class: "setting-val", "aria-live": "polite" }, s.value),
      button("›", () => s.onNext?.(), { class: "arrow", key: `${s.key}-next`, ariaLabel: s.next, disabled: !s.onNext }),
    ),
  );
}

export function titleScreen(state: AppState, actions: Actions): HTMLElement {
  const s = state.settings;
  const di = DIFFICULTIES.indexOf(s.difficulty);
  const cap = (d: string): string => d[0]!.toUpperCase() + d.slice(1);
  const rows: Stepper[] = [
    {
      label: "Opponents",
      value: String(s.bots),
      prev: "Fewer opponents",
      next: "More opponents",
      key: "bots",
      onPrev: s.bots > MIN_BOTS ? () => actions.setSettings({ bots: s.bots - 1 }) : null,
      onNext: s.bots < MAX_BOTS ? () => actions.setSettings({ bots: s.bots + 1 }) : null,
    },
    {
      label: "Difficulty",
      value: cap(s.difficulty),
      prev: "Easier",
      next: "Harder",
      key: "diff",
      onPrev: di > 0 ? () => actions.setSettings({ difficulty: DIFFICULTIES[di - 1]! }) : null,
      onNext: di < DIFFICULTIES.length - 1 ? () => actions.setSettings({ difficulty: DIFFICULTIES[di + 1]! }) : null,
    },
    {
      label: "Out at",
      value: `${s.cardCap} cards`,
      prev: "Lower card limit",
      next: "Higher card limit",
      key: "cap",
      onPrev: s.cardCap > MIN_CAP ? () => actions.setSettings({ cardCap: s.cardCap - 1 }) : null,
      onNext: s.cardCap < MAX_CAP ? () => actions.setSettings({ cardCap: s.cardCap + 1 }) : null,
    },
  ];
  return h(
    "main",
    { class: "screen title-screen" },
    backdropEl("title"),
    h(
      "div",
      { class: "title-head" },
      h("h1", { class: "logo" }, "BS Poker"),
      h("span", { class: "byline" }, "A game of bluffs by Samarth"),
    ),
    h(
      "div",
      { class: "top-btns title-help" },
      button("?", () => actions.toggleHelp(true), { class: "round-btn rye", key: "help", ariaLabel: "How to play" }),
    ),
    h(
      "div",
      { class: "hud hud-title" },
      rows.map(stepperRow),
      button("Take a seat", () => actions.startGame(), { class: "brush parchment big rye-btn", key: "play" }),
    ),
  );
}
