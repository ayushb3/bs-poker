/** Offline critter avatars: an emoji in a gradient circle. */
import type { Seat } from "../app/state";
import { h } from "./dom";

export function avatarEl(seat: Seat, size: "lg" | "md" | "sm" = "md"): HTMLElement {
  const style = `--hue:${seat.hue}`;
  return h(
    "div",
    { class: `avatar ${size}${seat.human ? " human" : ""}`, style, "aria-hidden": "true" },
    h("span", { class: "critter" }, seat.critter),
  );
}
