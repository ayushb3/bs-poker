/**
 * The shared Saloon scene: blurred back wall, seated figures, the perspective
 * table with its candle, and whatever sits on the felt. Used by the turn and
 * reveal screens.
 */
import type { GameState } from "../engine";
import type { AppState, Seat } from "../app/state";
import type { Mood } from "../app/reveal";
import { ART, PORTRAIT_ART } from "./assets";
import { cardBackEl, fan } from "./cards";
import { h } from "./dom";
import { TABLE, fanStep, seatSpots, type SeatSpot } from "./layout";

export interface FigureState {
  readonly mood: Mood;
  readonly active: boolean;
  readonly thinking: boolean;
  readonly out: boolean;
  readonly label: string;
}

export function figureEl(seat: Seat, spot: SeatSpot, f: FigureState, enter: boolean): HTMLElement {
  const art = seat.portrait ? PORTRAIT_ART[seat.portrait][f.mood] : null;
  const cls = ["figure", `mood-${f.mood}`];
  if (f.active) cls.push("active");
  if (f.thinking) cls.push("thinking");
  if (f.out) cls.push("out");
  if (seat.variant === 1) cls.push("alt");
  if (enter) cls.push("enter");
  const moodWord = f.mood === "neutral" ? (f.thinking ? "thinking" : "waiting") : f.mood;
  return h(
    "div",
    {
      class: cls.join(" "),
      style: `left:${(spot.cx - spot.w / 2).toFixed(1)}px;top:${spot.bottom}px;width:${spot.w}px`,
    },
    h(
      "span",
      { class: "fig-label" },
      f.label,
      f.thinking ? h("span", { class: "think-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")) : null,
    ),
    art ? h("img", { class: "fig-art", src: art, alt: `${seat.name}, ${f.out ? "out" : moodWord}`, draggable: "false" }) : null,
  );
}

/** Face-down cards in front of each bot, laid in the table plane. */
function backsFor(spot: SeatSpot, count: number, deal: boolean, seatIndex: number): HTMLElement[] {
  const w = spot.backW;
  const step = fanStep(count, w, spot.slot * 0.7, w * 0.55);
  const total = w + step * (count - 1);
  const out: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const { rot } = fan(i, count, 9, 0);
    const x = spot.tx - total / 2 + i * step;
    const y = spot.ty + Math.abs(i - (count - 1) / 2) * 3;
    const delay = deal ? `animation-delay:${(seatIndex * 2 + i) * 60}ms;` : "";
    out.push(
      cardBackEl(w, `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;--rot:${rot}deg;${delay}`),
    );
  }
  if (deal) for (const el of out) el.classList.add("deal");
  return out;
}

export interface SceneOpts {
  readonly state: AppState;
  readonly game: GameState;
  /** "turn": candle-dark, backs on the table. "reveal": brighter, felt bare. */
  readonly mode: "turn" | "reveal";
  readonly figure: (seat: Seat) => FigureState;
  readonly dealBacks: boolean;
  readonly enterFigures: boolean;
}

export function sceneEl(o: SceneOpts): { scene: HTMLElement; spots: Map<number, SeatSpot> } {
  const bots = o.state.seats.filter((s) => !s.human);
  const spotsArr = seatSpots(bots.length);
  const spots = new Map<number, SeatSpot>();
  bots.forEach((s, i) => spots.set(s.id, spotsArr[i]!));

  const backs: HTMLElement[] = [];
  if (o.mode === "turn") {
    bots.forEach((s, i) => {
      const p = o.game.players[s.id];
      if (!p || p.eliminated) return;
      backs.push(...backsFor(spots.get(s.id)!, p.cardCount, o.dealBacks, i));
    });
  }

  const scene = h(
    "div",
    { class: `scene scene-${o.mode}` },
    h("div", { class: "figures" }, bots.map((s) => figureEl(s, spots.get(s.id)!, o.figure(s), o.enterFigures))),
    h(
      "div",
      {
        class: "table-wrap",
        style: `left:${TABLE.left}px;top:${TABLE.top}px;width:${TABLE.width}px;height:${TABLE.height}px;perspective:${TABLE.perspective}px`,
        "aria-hidden": "true",
      },
      h(
        "div",
        { class: "rail", style: `background-image:url("${ART.rail}");transform:rotateX(${TABLE.tilt}deg)` },
        h("div", { class: "felt" }),
        backs,
      ),
    ),
    h("div", { class: "candle-glow", "aria-hidden": "true" }),
    h(
      "div",
      { class: "candle", "aria-hidden": "true" },
      h("span", { class: "flame" }),
      h("img", { src: ART.candlestick, alt: "", draggable: "false" }),
    ),
  );
  return { scene, spots };
}

/** Wall, warm light, grain and vignette sit outside the scene so they never shift. */
export function backdropEl(mode: "turn" | "reveal" | "title" | "over"): HTMLElement {
  const img = mode === "title" || mode === "over" ? ART.title : ART.wall;
  return h(
    "div",
    { class: `backdrop backdrop-${mode}`, "aria-hidden": "true" },
    h("div", { class: "bd-img", style: `background-image:url("${img}")` }),
    h("div", { class: "bd-warm" }),
  );
}
