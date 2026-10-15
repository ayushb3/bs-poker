/** Reveal screen: every hand face up, witness cards in gold, verdict and who takes a card. */
import type { GameState } from "../engine";
import { bidLabel, explain } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState } from "../app/state";
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
  const loserNow = game.players[r.loser]?.cardCount ?? 0;
  const bidderIsYou = r.bidder === HUMAN;
  const callerIsYou = r.caller === HUMAN;

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

  const headline = `${name(r.caller)} called BS on ${bidderIsYou ? "your" : `${name(r.bidder)}'s`} ${bidLabel(r.bid)}`;
  const verdictTitle = r.existed ? "It was there!" : "It wasn't there.";
  const loserLine = `${name(r.loser)} ${r.loser === HUMAN ? "take" : "takes"} +1 card (now ${loserNow}).`;
  const outLine =
    r.eliminated.length > 0
      ? r.eliminated.map((e) => `${name(e)} ${e === HUMAN ? "are" : "is"} out at ${game.config.cardCap} cards.`).join(" ")
      : null;
  const youLine = r.loser === HUMAN ? "Ouch." : callerIsYou || bidderIsYou ? "Nice one." : null;

  return h(
    "main",
    { class: "screen reveal" },
    h("h2", { class: "reveal-title" }, headline),
    h("div", { class: "reveal-pool" }, rows),
    h(
      "div",
      { class: "legend" },
      ex.exists ? "Gold cards make the hand (wilds included)" : "Gold cards are the closest partial match",
    ),
    h(
      "div",
      { class: `verdict ${r.existed ? "yes" : "no"}` },
      h("div", { class: "verdict-title" }, verdictTitle),
      h("div", { class: "verdict-sum" }, ex.summary),
      h("div", { class: "verdict-loser" }, loserLine, youLine ? ` ${youLine}` : ""),
      outLine ? h("div", { class: "verdict-out" }, outLine) : null,
      // M2 "what were the odds" line goes here.
      h("div", { id: "odds-line", class: "odds-line" }),
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
