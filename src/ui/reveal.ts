/**
 * Reveal: every hand face up in front of its owner. Cards that make the
 * claimed hand glow gold and lift, the rest dim. The winner of the call looks
 * smug, the loser caught. Banner, breakdown, odds and the outcome follow.
 */
import type { Card, GameState } from "../engine";
import { bidLabel, explain } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState } from "../app/state";
import { outcomeText, revealMood, revealText } from "../app/reveal";
import { shortOdds } from "../app/odds";
import { backdropEl, lightAge, sceneEl } from "./scene";
import { cardEl, fan } from "./cards";
import { h, button } from "./dom";
import { fanStep } from "./layout";
import { headerEl } from "./game";

/** Flip the cards in once per reveal. */
let flippedKey = "";

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function revealCard(card: Card, w: number, witness: boolean, flip: boolean, order: number, extra: string): HTMLElement {
  const delay = flip ? `animation-delay:calc(${200 + order * 70}ms * var(--anim, 1));` : "";
  return cardEl(card, {
    width: w,
    cls: `${witness ? "witness" : "dim"}${flip ? " flip" : ""}`,
    style: `${extra}${delay}`,
  });
}

export function revealScreen(state: AppState, game: GameState, actions: Actions, short: boolean): HTMLElement {
  const r = game.lastResult;
  if (!r) {
    return h(
      "main",
      { class: "screen reveal" },
      backdropEl("reveal"),
      h("div", { class: "hud" }, button("Continue", () => actions.nextRound(), { class: "brush parchment", key: "next" })),
    );
  }
  const name = (seat: number): string => state.seats[seat]?.name ?? `Player ${seat}`;
  const ex = r.explanation ?? explain(r.bid, r.pool);
  const witness = new Set(ex.cards.map((c) => c.id));
  const key = `${game.round}:${r.bidder}:${r.caller}:${r.pool.length}`;
  const flip = key !== flippedKey;
  flippedKey = key;
  const light = lightAge("reveal", flip);

  const { scene, spots } = sceneEl({
    state,
    game,
    mode: "reveal",
    dealBacks: false,
    enterFigures: false,
    lightAge: light,
    figure: (seat) => {
      const p = game.players[seat.id];
      const wasIn = (p?.hand.length ?? 0) > 0;
      return {
        mood: wasIn ? revealMood(r, seat.id) : "neutral",
        active: false,
        thinking: false,
        out: !wasIn,
        label: wasIn ? seat.name : `${seat.name} · out`,
      };
    },
  });

  // Bots' hands, face up in front of each figure.
  let order = 0;
  for (const seat of state.seats) {
    if (seat.human) continue;
    const p = game.players[seat.id];
    const spot = spots.get(seat.id);
    if (!p || !spot || p.hand.length === 0) continue;
    const n = p.hand.length;
    const w = spot.revealW;
    const step = fanStep(n, w, spot.slot, w * 0.8);
    const total = w + step * (n - 1);
    const row = h("div", {
      class: "reveal-hand",
      style: `left:${(spot.cx - total / 2).toFixed(1)}px;top:${spot.bottom + 8}px;width:${total.toFixed(1)}px;height:${w * 1.5}px`,
      role: "group",
      "aria-label": `${seat.name}'s cards`,
    });
    p.hand.forEach((c, i) => {
      const { rot } = fan(i, n, 7, 0);
      const wit = witness.has(c.id);
      const extra = `left:${(i * step).toFixed(1)}px;--rot:${rot}deg;--lift:${wit ? -6 : 0}px;`;
      row.appendChild(revealCard(c, w, wit, flip, order++, extra));
    });
    scene.appendChild(row);
  }

  const t = revealText(game, r, { name, human: HUMAN });
  const out = outcomeText(game, r, { name, human: HUMAN });
  const odds = state.odds ? shortOdds(state.odds) : null;
  const caught = !r.existed;
  const callerName = r.caller === HUMAN ? "You" : name(r.caller);
  const bidderName = r.bidder === HUMAN ? "your" : possessive(name(r.bidder));

  scene.appendChild(
    h(
      "div",
      { class: "verdict", role: "status" },
      h("div", { class: `verdict-banner ${caught ? "caught" : "there"}` }, h("span", null, caught ? "Caught bluffing" : "It was there")),
      h("span", { class: "verdict-line" }, `${callerName} called BS on ${bidderName} `, h("b", null, bidLabel(r.bid))),
      h("span", { class: "verdict-sum" }, ex.summary),
      odds ? h("span", { class: "verdict-odds" }, odds.overall, h("span", { class: "odds-seat" }, odds.seat)) : null,
    ),
  );

  // Your cards along the bottom.
  const me = game.players[HUMAN];
  const mine = me?.hand ?? [];
  const w = short ? 48 : 64;
  const n = mine.length;
  const step = fanStep(n, w, 340, w * 0.8);
  const yourHand =
    n > 0
      ? h(
          "div",
          { class: "hand-area reveal-mine" },
          h(
            "div",
            { class: "hand", "aria-label": "Your cards", style: `--hw:${w}px` },
            mine.map((c, i) => {
              const { rot, dy } = fan(i, n, n <= 2 ? 13 : 7, 2);
              const wit = witness.has(c.id);
              const extra = `--x:${((i - (n - 1) / 2) * step).toFixed(1)}px;--rot:${rot}deg;--dy:${dy + (wit ? -8 : 0)}px;`;
              return cardEl(c, { width: w, cls: `in-hand ${wit ? "witness" : "dim"}`, style: extra });
            }),
          ),
        )
      : null;

  const over = game.phase === "over";
  return h(
    "main",
    { class: "screen reveal" },
    backdropEl("reveal", light),
    scene,
    yourHand,
    h(
      "div",
      { class: "hud hud-reveal" },
      h(
        "span",
        { class: "outcome" },
        out.take,
        " ",
        h("span", { class: "muted" }, out.holding),
        t.youLine ? h("span", { class: "muted" }, ` ${t.youLine}`) : null,
      ),
      t.outLine && r.eliminated.length > 1 ? h("span", { class: "outcome muted" }, t.outLine) : null,
      h(
        "div",
        { class: "hud-row" },
        over ? button("Rematch", () => actions.rematch(), { class: "text-btn", key: "rematch" }) : null,
        button(over ? "See results" : "Next round", () => actions.nextRound(), { class: "brush parchment big", key: "next" }),
      ),
    ),
    headerEl(game, actions, `Round ${game.round} · reveal`, false),
  );
}
