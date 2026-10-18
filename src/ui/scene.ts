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

/** How the room is lit: dark silhouettes during turns, bright art on the reveal. */
export type Light = "dark" | "lit";

/** Each figure's mood on the last reveal, so "Next round" fades back from the face they were pulling. */
const litMoods = new Map<number, Mood>();

/** Delay between seats when the light changes, so the room comes up left to right. */
const LIGHT_STAGGER_MS = 110;
/** Long enough to cover the slowest light animation (stagger, fades, the verdict landing). */
const LIGHT_SETTLE_MS = 1800;

let lightMode: "turn" | "reveal" | null = null;
let lightStart = 0;

/**
 * Milliseconds since the room's light last changed into `mode`, or null once it
 * has settled. `fresh` marks the render where the change happens. Re-renders
 * during the change (a bot moving on Instant, opening help) pass the age on as
 * a negative animation delay, so the fade carries on instead of restarting or snapping.
 */
export function lightAge(mode: "turn" | "reveal", fresh: boolean): number | null {
  const now = performance.now();
  if (fresh) {
    lightMode = mode;
    lightStart = now;
    return 0;
  }
  const age = now - lightStart;
  return lightMode === mode && age < LIGHT_SETTLE_MS ? age : null;
}

function ageStyle(age: number | null): string {
  return age === null ? "" : `--light-age:${(-age).toFixed(0)}ms;`;
}

/**
 * The figure's art: a silhouette with the bright painted look stacked on it
 * (when lit, or while fading back down). CSS cross-fades the two when `change` is set.
 */
function figureArt(seat: Seat, f: FigureState, light: Light, change: boolean, order: number): HTMLElement | null {
  if (!seat.portrait) return null;
  const art = PORTRAIT_ART[seat.portrait];
  const moodWord = f.mood === "neutral" ? (f.thinking ? "thinking" : "waiting") : f.mood;
  const label = `${seat.name}, ${f.out ? "out" : light === "dark" ? `in shadow, ${moodWord}` : moodWord}`;
  const brightMood = light === "lit" ? f.mood : (litMoods.get(seat.id) ?? "neutral");
  const delay = change ? `animation-delay:calc(${order * LIGHT_STAGGER_MS}ms + var(--light-age, 0ms))` : "";
  return h(
    "div",
    { class: `fig-stack light-${light}`, role: "img", "aria-label": label },
    h("img", { class: "fig-art fig-dark", src: art.dark, alt: "", draggable: "false", style: delay }),
    light === "lit" || change
      ? h("img", { class: "fig-art fig-lit", src: art[brightMood], alt: "", draggable: "false", style: delay })
      : null,
  );
}

export function figureEl(
  seat: Seat,
  spot: SeatSpot,
  f: FigureState,
  enter: boolean,
  light: Light = "dark",
  change = false,
  order = 0,
): HTMLElement {
  const cls = ["figure", `mood-${f.mood}`];
  if (f.active) cls.push("active");
  if (f.thinking) cls.push("thinking");
  if (f.out) cls.push("out");
  if (seat.variant === 1) cls.push("alt");
  if (enter) cls.push("enter");
  if (change) cls.push("light-change");
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
    figureArt(seat, f, light, change, order),
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
  /** From lightAge(): set while the light is changing into this mode (up on a reveal, down on the next deal). */
  readonly lightAge: number | null;
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

  const light: Light = o.mode === "reveal" ? "lit" : "dark";
  const states = new Map(bots.map((s) => [s.id, o.figure(s)] as const));
  if (light === "lit") {
    litMoods.clear();
    for (const [id, f] of states) litMoods.set(id, f.mood);
  }
  const change = o.lightAge !== null;
  const figures = bots.map((s, i) => figureEl(s, spots.get(s.id)!, states.get(s.id)!, o.enterFigures, light, change, i));

  const scene = h(
    "div",
    { class: `scene scene-${o.mode}${change ? " light-change" : ""}`, style: ageStyle(o.lightAge) },
    h("div", { class: "figures" }, figures),
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

/**
 * Wall, warm light, grain and vignette sit outside the scene so they never shift.
 * `lightAge` (from lightAge()) animates the room up into the reveal, or back down into a turn.
 */
export function backdropEl(mode: "turn" | "reveal" | "title" | "over", lightAge: number | null = null): HTMLElement {
  const img = mode === "title" || mode === "over" ? ART.title : ART.wall;
  return h(
    "div",
    {
      class: `backdrop backdrop-${mode}${lightAge !== null ? " light-change" : ""}`,
      style: ageStyle(lightAge),
      "aria-hidden": "true",
    },
    h("div", { class: "bd-img", style: `background-image:url("${img}")` }),
    h("div", { class: "bd-warm" }),
  );
}
