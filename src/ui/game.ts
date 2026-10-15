/** The game screen: opponents around the felt, the plaque, your hand and the controls. */
import type { GameState } from "../engine";
import { bidLabel, poolOf } from "../engine";
import type { Actions } from "../app/controller";
import { HUMAN } from "../app/controller";
import type { AppState, Opener, Seat } from "../app/state";
import { settingsSummary } from "../app/state";
import { avatarEl } from "./avatars";
import { cardEl, miniCards } from "./cards";
import { h, button } from "./dom";
import { bidPicker } from "./picker";

/** Only animate the deal once per round, not on every re-render. */
let dealtRound = -1;
let dealtGame: GameState | null = null;

/** Opponents sit on the upper arc of the oval (desktop); CSS flattens this to a row on phones. */
function opponentPosition(i: number, total: number): { x: number; y: number } {
  const startDeg = 20;
  const endDeg = 160;
  const frac = total === 1 ? 0.5 : i / (total - 1);
  const angle = ((startDeg + frac * (endDeg - startDeg)) * Math.PI) / 180;
  const rx = 44;
  const ry = 35;
  return { x: 50 + rx * Math.cos(angle), y: 50 - ry * Math.sin(angle) };
}

function opponentEl(seat: Seat, game: GameState, state: AppState, pos: { x: number; y: number }): HTMLElement {
  const p = game.players[seat.id];
  const eliminated = p?.eliminated ?? false;
  const count = p?.cardCount ?? 0;
  const active = game.phase === "bidding" && game.turn === seat.id && !eliminated;
  const thinking = active && state.thinking === seat.id;
  const classes = ["opponent"];
  if (active) classes.push("active");
  if (thinking) classes.push("thinking");
  if (eliminated) classes.push("eliminated");
  return h(
    "div",
    {
      class: classes.join(" "),
      style: `--x:${pos.x.toFixed(1)}%;--y:${pos.y.toFixed(1)}%`,
      "aria-label": `${seat.name}, ${eliminated ? "eliminated" : `${count} card${count === 1 ? "" : "s"}`}${thinking ? ", thinking" : ""}`,
    },
    thinking ? h("div", { class: "thinking-dots", "aria-hidden": "true" }, "•••") : null,
    avatarEl(seat, "lg"),
    h("div", { class: "name" }, seat.name),
    h("div", { class: "cards" }, eliminated ? "OUT" : `${count} card${count === 1 ? "" : "s"}`),
    eliminated ? null : miniCards(count),
  );
}

function plaque(state: AppState, game: GameState): HTMLElement {
  const last = game.bids[game.bids.length - 1];
  const seats = state.seats;
  if (state.flash) {
    return h("div", { class: "center" }, h("div", { class: "declaration bs-flash", role: "status" }, state.flash));
  }
  if (last) {
    const by = seats[last.player]?.name ?? "?";
    return h(
      "div",
      { class: "center" },
      h("div", { class: "declaration", role: "status" }, bidLabel(last.bid)),
      h("div", { class: "by" }, `bid by ${by}`),
      turnInfo(state, game),
    );
  }
  return h(
    "div",
    { class: "center" },
    h("div", { class: "declaration quiet", role: "status" }, "No bid yet"),
    turnInfo(state, game),
  );
}

function turnInfo(state: AppState, game: GameState): HTMLElement {
  if (game.phase !== "bidding") return h("div", { class: "turn-info" }, "Showdown!");
  if (game.turn === HUMAN) return h("div", { class: "turn-info you" }, "Your move");
  const name = state.seats[game.turn]?.name ?? "CPU";
  return h("div", { class: "turn-info" }, `${name} is thinking…`);
}

/** "Vega lost, so Vega opens" / "you lost, so you open" / "Vega opens" — shown while the round has no bid yet. */
function openerHint(state: AppState, game: GameState, opener: Opener | null): string | null {
  if (!opener || game.phase !== "bidding") return null;
  const you = opener.seat === HUMAN;
  const name = you ? "you" : (state.seats[opener.seat]?.name ?? "?");
  const opens = you ? "open" : "opens";
  return opener.reason === "lost" ? `${name} lost, so ${name} ${opens}` : `${name} ${opens}`;
}

function historyStrip(state: AppState, game: GameState): HTMLElement {
  const recent = game.bids.slice(-5);
  const hint = openerHint(state, game, state.opener);
  return h(
    "div",
    { class: "history", "aria-label": "Recent bids" },
    recent.length === 0
      ? h(
          "span",
          { class: "hist-empty" },
          `Round ${game.round} · ${poolOf(game).length} cards in the pool`,
          hint ? h("span", { class: "opener-hint" }, ` · ${hint}`) : null,
        )
      : recent.map((r, i) =>
          h(
            "span",
            { class: `hist${i === recent.length - 1 ? " latest" : ""}` },
            h("b", null, state.seats[r.player]?.name ?? "?"),
            " ",
            bidLabel(r.bid),
          ),
        ),
  );
}

function controls(state: AppState, game: GameState, actions: Actions): HTMLElement {
  if (state.flash) {
    return h(
      "div",
      { class: "controls waiting" },
      h("span", { class: "wait-text" }, state.flash),
      button("Show cards", () => actions.skipThinking(), { class: "skip", key: "skip" }),
    );
  }
  if (game.phase === "bidding" && game.turn === HUMAN) {
    return h("div", { class: "controls" }, bidPicker(state, game, actions));
  }
  const name = state.seats[game.turn]?.name ?? "CPU";
  return h(
    "div",
    { class: "controls waiting" },
    h("span", { class: "wait-text" }, h("span", { class: "dots", "aria-hidden": "true" }, "•••"), ` ${name} is thinking`),
    button("Skip", () => actions.skipThinking(), { class: "skip", key: "skip" }),
  );
}

function logPanel(state: AppState): HTMLElement {
  const entries = state.log.slice(-12);
  return h(
    "aside",
    { class: "log", "aria-label": "Game log" },
    h("h3", null, "Log"),
    entries.length === 0
      ? h("div", { class: "entry" }, "The table is quiet…")
      : entries.map((e) => h("div", { class: `entry ${e.kind}` }, `R${e.round} · ${e.text}`)),
  );
}

export function gameScreen(state: AppState, game: GameState, actions: Actions): HTMLElement {
  const me = game.players[HUMAN];
  const hand = me?.hand ?? [];
  const animate = dealtRound !== game.round || dealtGame === null;
  if (animate) {
    dealtRound = game.round;
    dealtGame = game;
  }
  const bots = state.seats.filter((s) => !s.human);
  const pool = poolOf(game).length;

  return h(
    "main",
    { class: "screen game" },
    h(
      "header",
      { class: "game-header" },
      button("?", () => actions.toggleHelp(true), { class: "help-btn", key: "help", ariaLabel: "How to play" }),
      h(
        "div",
        { class: "title-small" },
        h("h1", null, "BS Poker"),
        h("div", { class: "sub" }, `Round ${game.round} · ${pool} cards in play`),
        h("div", { class: "settings-summary", title: "Settings for this game" }, settingsSummary(state.settings)),
      ),
      button("Quit", () => actions.confirmQuit(true), {
        class: `ghost small${state.confirmQuit ? " selected" : ""}`,
        key: "quit",
        ariaLabel: "Quit game",
        pressed: state.confirmQuit,
      }),
      state.confirmQuit
        ? h(
            "div",
            { class: "quit-confirm", role: "group", "aria-label": "Quit game?" },
            h("span", { class: "quit-q" }, "Quit game?"),
            button("Yes", () => actions.changeSettings(), { class: "bs small", key: "quit-yes" }),
            button("No", () => actions.confirmQuit(false), { class: "small", key: "quit-no" }),
            button("Change settings", () => actions.changeSettings(), { class: "ghost small", key: "quit-settings" }),
          )
        : null,
    ),
    h(
      "div",
      { class: "table-area" },
      h(
        "div",
        { class: "opponents" },
        bots.map((seat, i) => opponentEl(seat, game, state, opponentPosition(i, bots.length))),
      ),
      h("div", { class: "table" }, plaque(state, game)),
      h(
        "div",
        { class: "player" },
        h(
          "div",
          { class: `label${game.phase === "bidding" && game.turn === HUMAN ? " your-turn" : ""}` },
          avatarEl(state.seats[HUMAN] ?? { id: 0, name: "You", critter: "😎", hue: 46, human: true }, "sm"),
          h("b", null, "You"),
          h("span", { class: "count" }, `${me?.cardCount ?? 0} card${me?.cardCount === 1 ? "" : "s"}`),
        ),
        h(
          "div",
          { class: `hand${hand.length > 5 ? " crowded" : ""}`, "aria-label": "Your hand" },
          hand.map((c, i) => cardEl(c, animate ? { deal: i } : {})),
        ),
      ),
    ),
    historyStrip(state, game),
    controls(state, game, actions),
    logPanel(state),
  );
}
