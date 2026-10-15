/** Title screen: credit, settings and Play. */
import type { Actions } from "../app/controller";
import type { AppState } from "../app/state";
import { MAX_BOTS, MAX_CAP, MIN_BOTS, MIN_CAP } from "../app/state";
import { DIFFICULTIES } from "../cpu";
import { h, button } from "./dom";

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

function segmented<T extends string | number>(
  name: string,
  options: readonly T[],
  value: T,
  onPick: (v: T) => void,
  label: (v: T) => string = (v) => String(v),
): HTMLElement {
  return h(
    "div",
    { class: "seg", role: "group", "aria-label": name },
    options.map((o) =>
      button(label(o), () => onPick(o), {
        class: `seg-btn${o === value ? " selected" : ""}`,
        key: `${name}-${o}`,
        pressed: o === value,
      }),
    ),
  );
}

export function titleScreen(state: AppState, actions: Actions): HTMLElement {
  const s = state.settings;
  return h(
    "main",
    { class: "screen title-screen" },
    h(
      "div",
      { class: "title-card" },
      h("h1", { class: "logo" }, "BS Poker"),
      h("p", { class: "credit" }, h("span", { class: "credit-by" }, "Invented by"), " ", h("b", { class: "credit-name" }, "Samarth")),
      h("p", { class: "tagline" }, "A bluffing card game"),
      h(
        "div",
        { class: "settings" },
        h(
          "div",
          { class: "setting" },
          h("span", { class: "lbl" }, "Opponents"),
          segmented("Opponents", range(MIN_BOTS, MAX_BOTS), s.bots, (v) => actions.setSettings({ bots: v })),
        ),
        h(
          "div",
          { class: "setting" },
          h("span", { class: "lbl" }, "Difficulty"),
          segmented("Difficulty", DIFFICULTIES, s.difficulty, (v) => actions.setSettings({ difficulty: v }), (v) =>
            v[0]!.toUpperCase() + v.slice(1),
          ),
        ),
        h(
          "div",
          { class: "setting" },
          h("span", { class: "lbl" }, "Card cap"),
          segmented("Card cap", range(MIN_CAP, MAX_CAP), s.cardCap, (v) => actions.setSettings({ cardCap: v })),
          h("span", { class: "hint" }, "Reach this many cards and you're out"),
        ),
      ),
      h(
        "div",
        { class: "title-actions" },
        button("Play", () => actions.startGame(), { class: "confirm big", key: "play" }),
        button("How to play", () => actions.toggleHelp(true), { class: "ghost", key: "how" }),
      ),
    ),
    h("footer", { class: "title-foot" }, "Rules v0.3 · decided by simulation"),
  );
}
