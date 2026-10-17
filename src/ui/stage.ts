/**
 * Fits the 390px-wide stage to the window. Phones: fill the width; the stage
 * grows or shrinks in height (min 700 logical px). Wider screens: a centred
 * phone column at the 844px reference height over a dark, blurred backdrop.
 * Exposes --off (how far the scene block shifts for the stage height).
 */
import { REF_H, STAGE_W } from "./layout";

const MIN_H = 700;

export function fitStage(stage: HTMLElement): () => void {
  function fit(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let s: number;
    if (vw < 600) s = Math.min(vw / STAGE_W, vh / MIN_H);
    else s = Math.min(vh / REF_H, 1.35);
    const H = Math.max(MIN_H, vh / s);
    const off = Math.max(-70, Math.min(40, (H - REF_H) * 0.5));
    const left = Math.max(0, (vw - STAGE_W * s) / 2);
    stage.style.setProperty("--s", String(s));
    stage.style.setProperty("--H", `${H}px`);
    stage.style.setProperty("--off", `${off}px`);
    stage.style.left = `${left}px`;
    stage.classList.toggle("short", H < 780);
  }
  fit();
  window.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("resize", fit);
  return () => {
    window.removeEventListener("resize", fit);
    window.visualViewport?.removeEventListener("resize", fit);
  };
}
