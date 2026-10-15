/** Reveal screen: every hand face up, witness cards in gold, verdict and who takes a card. */
import type { GameState } from "../engine";
import { explain } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState } from "../app/state";
import { revealText } from "../app/reveal";
import { avatarEl } from "./avatars";
import { cardEl } from "./cards";
import { h, button } from "./dom";

export function revealScreen(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const r = game.lastResult;
  if (!r) {
    return h("main", { class: "screen reveal" }, h("p", null, "Nothing to reveal."), button("Continue", () => actions.nextRound(), { key: "next" }));
  }
  const name = (seat: number): string => state.seats[seat]?.name ?? `Player ${seat}`;
  // The engine already explains the result; recompute defensively if it is ever missing.
  const ex = r.explanation ?? explain(r.bid, r.pool);
  const witness = new Set(ex.cards.map((c) => c.id));
  const rows = game.players
    .filter((p) => p.hand.length > 0)
    .map((p) => {
      const seat = state.seats[p.id];
      const role = p.id === r.bidder ? "bidder" : p.id === r.caller ? "caller" : "";
      return h(
        "div",
        { class: `reveal-row${role ? ` ${role}` : ""}` },
        h(
          "div",
          { class: "who" },
          seat ? avatarEl(seat, "sm") : null,
          h("span", { class: "who-name" }, seat?.name ?? `Player ${p.id}`),
          role ? h("span", { class: "role" }, role === "bidder" ? "bid" : "called") : null,
        ),
        h(
          "div",
          { class: "row-cards" },
          p.hand.map((c) => cardEl(c, { size: "small", witness: witness.has(c.id) })),
        ),
      );
    });

  const t = revealText(game, r, { name, human: HUMAN });

  return h(
    "main",
    { class: "screen reveal" },
    h("h2", { class: "reveal-title" }, t.headline),
    h("div", { class: "reveal-pool" }, rows),
    h(
      "div",
      { class: "legend" },
      ex.exists ? "Gold cards make the hand (wilds included)" : "Gold cards are the closest partial match",
    ),
    h(
      "div",
      { class: `verdict ${r.existed ? "yes" : "no"}` },
      h("div", { class: "verdict-title" }, t.verdictTitle),
      h("div", { class: "verdict-sum" }, ex.summary),
      h("div", { class: "verdict-loser" }, t.loserLine, t.youLine ? ` ${t.youLine}` : ""),
      t.outLine ? h("div", { class: "verdict-out" }, t.outLine) : null,
      state.oddsLine ? h("div", { id: "odds-line", class: "odds-line" }, state.oddsLine) : null,
    ),
    h(
      "div",
      { class: "reveal-actions" },
      button(game.phase === "over" ? "See results" : "Next round", () => actions.nextRound(), {
        class: "confirm big",
        key: "next",
      }),
    ),
  );
}
