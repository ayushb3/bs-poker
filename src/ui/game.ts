/** The turn screen: figures around the candlelit table, the claim, your hand and the HUD. */
import type { GameState } from "../engine";
import { bidLabel, poolOf } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState, Opener } from "../app/state";
import { backdropEl, sceneEl } from "./scene";
import { cardEl, claimCards, fan } from "./cards";
import { h, button } from "./dom";
import { bidHud, changeHandSheet } from "./picker";
import { getLocal, resetLocal } from "./local";
import { fanStep } from "./layout";

/** Animate deals and claims once per change, not on every re-render. */
let dealtKey = "";
let claimKey = "";
let seenGame: GameState | null = null;

function name(state: AppState, seat: number): string {
  return state.seats[seat]?.name ?? `Player ${seat}`;
}

/** "Vega lost, so Vega opens" / "You lost, so you open" / "Vega opens". */
function openerHint(state: AppState, opener: Opener | null): string | null {
  if (!opener) return null;
  const you = opener.seat === HUMAN;
  const who = you ? "You" : name(state, opener.seat);
  const opens = you ? "open" : "opens";
  return opener.reason === "lost" ? `${who} lost, so ${you ? "you" : who} ${opens}` : `${who} ${opens}`;
}

export function headerEl(game: GameState, actions: Actions, right: string | null, canQuit: boolean): HTMLElement {
  return h(
    "header",
    { class: "top" },
    h(
      "div",
      { class: "brand" },
      h("span", { class: "wordmark" }, "BS Poker"),
      h("span", { class: "round-tag" }, right ?? `Round ${game.round} · out at ${game.config.cardCap}`),
    ),
    h(
      "div",
      { class: "top-btns" },
      button("?", () => actions.toggleHelp(true), { class: "round-btn rye", key: "help", ariaLabel: "How to play" }),
      canQuit
        ? button("✕", () => actions.confirmQuit(true), { class: "round-btn", key: "quit", ariaLabel: "Leave the table" })
        : null,
    ),
  );
}

function historyFeed(state: AppState, game: GameState): HTMLElement {
  const recent = game.bids.slice(-4);
  if (recent.length === 0) {
    const hint = openerHint(state, state.opener);
    return h("div", { class: "feed", "aria-label": "Bid history" }, hint ? h("span", null, hint) : null);
  }
  return h(
    "ol",
    { class: "feed", "aria-label": "Bid history" },
    recent.map((r, i) =>
      h(
        "li",
        { style: `opacity:${(0.4 + (0.6 * (i + 1)) / recent.length).toFixed(2)}` },
        `${name(state, r.player)} — ${bidLabel(r.bid)}`,
      ),
    ),
  );
}

function claimBlock(state: AppState, game: GameState): HTMLElement {
  const last = game.bids[game.bids.length - 1];
  const pool = poolOf(game).length;
  const key = `${game.round}:${game.bids.length}`;
  const fresh = key !== claimKey;
  claimKey = key;
  if (!last) {
    const opener = game.turn === HUMAN ? "Your lead" : `${name(state, game.turn)} to open`;
    return h(
      "div",
      { class: `claim${fresh ? " fresh" : ""}`, role: "status" },
      h("span", { class: "claim-who" }, `Round ${game.round}`),
      h("span", { class: "claim-bid quiet" }, opener),
      h("span", { class: "claim-pool" }, `${pool} cards on the table`),
    );
  }
  const cards = claimCards(last.bid);
  const who = last.player === HUMAN ? "You claim" : `${name(state, last.player)} claims`;
  return h(
    "div",
    { class: `claim${fresh ? " fresh" : ""}`, role: "status", "aria-live": "polite" },
    h("span", { class: "claim-who" }, who),
    h(
      "div",
      { class: "claim-cards", "aria-hidden": "true" },
      cards.map((c, i) => {
        const { rot, dy } = fan(i, cards.length);
        return cardEl(c, { width: 38, cls: "mini", style: `transform:rotate(${rot}deg) translateY(${dy}px)` });
      }),
    ),
    h("span", { class: "claim-bid" }, bidLabel(last.bid)),
    h("span", { class: "claim-pool" }, `${pool} cards on the table`),
  );
}

function handEl(game: GameState, deal: boolean, yourTurn: boolean, short: boolean): HTMLElement {
  const me = game.players[HUMAN];
  const hand = me?.hand ?? [];
  const w = short ? 74 : 94;
  const n = hand.length;
  const step = fanStep(n, w, 360, w * 0.78);
  const out = me?.eliminated ?? false;
  const label = out
    ? "You're out, watching"
    : yourTurn
      ? `Your move · ${n} card${n === 1 ? "" : "s"}`
      : `Your hand · ${n}`;
  return h(
    "div",
    { class: "hand-area" },
    h("div", { class: `hand-label${yourTurn ? " your-turn" : ""}` }, label),
    h(
      "div",
      { class: "hand", "aria-label": "Your hand", style: `--hw:${w}px` },
      hand.map((c, i) => {
        const { rot, dy } = fan(i, n, n <= 2 ? 13 : 7, 2);
        const x = (i - (n - 1) / 2) * step;
        const delay = deal ? `animation-delay:calc(${150 + i * 90}ms * var(--anim, 1));` : "";
        const style = `--x:${x.toFixed(1)}px;--rot:${rot}deg;--dy:${dy}px;${delay}`;
        return cardEl(c, { width: w, cls: `in-hand${deal ? " deal" : ""}`, style, ribbon: true });
      }),
    ),
  );
}

function waitingHud(state: AppState, game: GameState, actions: Actions): HTMLElement {
  if (state.flash) {
    return h(
      "div",
      { class: "hud hud-wait" },
      button("Show cards", () => actions.skipThinking(), { class: "brush parchment", key: "skip" }),
    );
  }
  return h(
    "div",
    { class: "hud hud-wait" },
    h(
      "span",
      { class: "wait-text", role: "status" },
      `${name(state, game.turn)} is thinking`,
      h("span", { class: "think-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
    ),
    button("Hurry them along", () => actions.skipThinking(), { class: "text-btn", key: "skip" }),
  );
}

function quitConfirm(actions: Actions): HTMLElement {
  return h(
    "div",
    { class: "sheet-layer" },
    h("div", { class: "sheet-scrim", onclick: () => actions.confirmQuit(false) }),
    h(
      "section",
      { class: "sheet quit-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Leave the table?" },
      h("h2", null, "Leave the table?"),
      h("p", null, "This game will be lost. Your settings are kept."),
      h(
        "div",
        { class: "hud-row" },
        button("Stay", () => actions.confirmQuit(false), { class: "text-btn", key: "quit-no" }),
        button("Leave", () => actions.changeSettings(), { class: "brush blood", key: "quit-yes" }),
      ),
    ),
  );
}

export function gameScreen(state: AppState, game: GameState, actions: Actions, short: boolean): HTMLElement {
  const newGame = seenGame === null || game.round < seenGame.round || game.players.length !== seenGame.players.length;
  const dkey = `${game.round}:${game.players.map((p) => p.hand.map((c) => c.id).join(",")).join("|")}`;
  const deal = dkey !== dealtKey;
  dealtKey = dkey;
  seenGame = game;

  const yourTurn = game.phase === "bidding" && game.turn === HUMAN && !state.flash;
  if (!yourTurn && getLocal().sheet) resetLocal({ sheet: false });

  const { scene } = sceneEl({
    state,
    game,
    mode: "turn",
    dealBacks: deal,
    enterFigures: newGame,
    figure: (seat) => {
      const p = game.players[seat.id];
      const out = p?.eliminated ?? false;
      const active = game.phase === "bidding" && game.turn === seat.id && !out;
      return {
        mood: "neutral",
        active,
        thinking: active && state.thinking === seat.id,
        out,
        label: out ? `${seat.name} · out` : `${seat.name} · ${p?.cardCount ?? 0}`,
      };
    },
  });
  scene.appendChild(claimBlock(state, game));

  return h(
    "main",
    { class: "screen game" },
    backdropEl("turn"),
    scene,
    state.flash ? h("div", { class: "flash-banner", role: "alert" }, h("span", null, state.flash)) : null,
    historyFeed(state, game),
    handEl(game, deal, yourTurn, short),
    yourTurn ? bidHud(state, game, actions) : waitingHud(state, game, actions),
    headerEl(game, actions, null, true),
    yourTurn ? changeHandSheet(state, game, actions) : null,
    state.confirmQuit ? quitConfirm(actions) : null,
  );
}
