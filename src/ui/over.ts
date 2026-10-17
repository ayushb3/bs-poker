/** Game over: the winner, final standings, rematch or change settings. */
import type { GameState } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState } from "../app/state";
import { standings as rankPlayers } from "../app/reveal";
import { PORTRAIT_ART } from "./assets";
import { backdropEl } from "./scene";
import { h, button } from "./dom";

export function overScreen(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const winner = game.winner;
  const wseat = winner == null ? null : state.seats[winner];
  const youWon = winner === HUMAN;
  const standings = rankPlayers(game);
  const art = wseat?.portrait ? PORTRAIT_ART[wseat.portrait].smug : null;
  return h(
    "main",
    { class: `screen over${youWon ? " you-won" : ""}` },
    backdropEl("over"),
    h(
      "div",
      { class: "over-head" },
      h("span", { class: "over-kicker" }, "Game over"),
      h("h1", { class: "over-title" }, youWon ? "You win" : `${wseat?.name ?? "Nobody"} wins`),
      h("span", { class: "over-sub" }, `${game.round} round${game.round === 1 ? "" : "s"} played`),
    ),
    art
      ? h("img", {
          class: `over-figure${wseat?.variant === 1 ? " alt" : ""}`,
          src: art,
          alt: `${wseat?.name ?? ""}, smug`,
          draggable: "false",
        })
      : h("div", { class: "over-pot", "aria-hidden": "true" }, "★"),
    h(
      "div",
      { class: "hud hud-over" },
      h(
        "ol",
        { class: "standings", "aria-label": "Final standings" },
        standings.map((p) => {
          const seat = state.seats[p.id];
          const result = p.id === winner ? "Winner" : p.eliminated ? "Out" : "In";
          return h(
            "li",
            { class: p.id === winner ? "is-winner" : p.eliminated ? "is-out" : "" },
            h("span", { class: "st-name" }, seat?.name ?? `Player ${p.id}`),
            h("span", { class: "st-cards" }, `${p.cardCount} card${p.cardCount === 1 ? "" : "s"}`),
            h("span", { class: "st-result" }, result),
          );
        }),
      ),
      button("Rematch", () => actions.rematch(), { class: "brush parchment big rye-btn", key: "again" }),
      button("Change settings", () => actions.changeSettings(), { class: "text-btn", key: "settings" }),
    ),
  );
}
