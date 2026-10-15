/** Game over: winner, final card counts, play again / change settings. */
import type { GameState } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState } from "../app/state";
import { standings as rankPlayers } from "../app/reveal";
import { avatarEl } from "./avatars";
import { h, button } from "./dom";

export function overScreen(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const winner = game.winner;
  const wseat = winner == null ? null : state.seats[winner];
  const youWon = winner === HUMAN;
  const standings = rankPlayers(game);
  return h(
    "main",
    { class: "screen over" },
    h(
      "div",
      { class: "panel over-box" },
      h("div", { class: "sub" }, "Game over"),
      h("h2", { class: "winner-title" }, youWon ? "You win!" : `${wseat?.name ?? "Nobody"} wins`),
      wseat ? h("div", { class: "winner-avatar" }, avatarEl(wseat, "lg")) : null,
      h(
        "table",
        { class: "standings" },
        h("thead", null, h("tr", null, h("th", null, "Player"), h("th", null, "Cards"), h("th", null, "Result"))),
        h(
          "tbody",
          null,
          standings.map((p) => {
            const seat = state.seats[p.id];
            return h(
              "tr",
              { class: p.id === winner ? "is-winner" : p.eliminated ? "is-out" : "" },
              h("td", null, h("span", { class: "cell-who" }, seat ? avatarEl(seat, "sm") : null, seat?.name ?? `Player ${p.id}`)),
              h("td", null, String(p.cardCount)),
              h("td", null, p.id === winner ? "Winner" : p.eliminated ? "Out" : "In"),
            );
          }),
        ),
      ),
      h("div", { class: "rounds" }, `${game.round} round${game.round === 1 ? "" : "s"} played`),
      h(
        "div",
        { class: "over-actions" },
        button("Rematch", () => actions.rematch(), { class: "confirm big", key: "again" }),
        button("Change settings", () => actions.changeSettings(), { class: "ghost", key: "settings" }),
      ),
    ),
  );
}
