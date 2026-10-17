/** Root renderer: rebuilds the screen from AppState (plus UI-local state) on every change. */
import type { App } from "../app/controller";
import type { AppState } from "../app/state";
import { gameScreen } from "./game";
import { helpPanel } from "./help";
import { overScreen } from "./over";
import { revealScreen } from "./reveal";
import { titleScreen } from "./title";
import { onLocalChange } from "./local";

function screenFor(state: AppState, app: App, short: boolean): HTMLElement {
  const { actions } = app;
  const game = state.game;
  switch (state.screen) {
    case "game":
      return game ? gameScreen(state, game, actions, short) : titleScreen(state, actions);
    case "reveal":
      return game ? revealScreen(state, game, actions, short) : titleScreen(state, actions);
    case "over":
      return game ? overScreen(state, game, actions) : titleScreen(state, actions);
    default:
      return titleScreen(state, actions);
  }
}

export function mountRenderer(root: HTMLElement, stage: HTMLElement, app: App): void {
  function render(state: AppState): void {
    // Remember which button had focus so keyboard users don't lose their place.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active?.dataset?.["key"] ?? null;

    const frag = document.createDocumentFragment();
    frag.appendChild(screenFor(state, app, stage.classList.contains("short")));
    if (state.showHelp) frag.appendChild(helpPanel(() => app.actions.toggleHelp(false)));
    root.replaceChildren(frag);
    root.dataset["screen"] = state.screen;

    if (state.showHelp) {
      root.querySelector<HTMLElement>('[data-key="help-close"]')?.focus({ preventScroll: true });
    } else if (focusKey) {
      const el = root.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`);
      if (el && !(el as HTMLButtonElement).disabled) el.focus({ preventScroll: true });
    }
  }

  app.subscribe(render);
  onLocalChange(() => render(app.getState()));
  // Stage height class can flip on resize: re-render so card sizes follow.
  new MutationObserver(() => render(app.getState())).observe(stage, { attributes: true, attributeFilter: ["class"] });
  render(app.getState());
}
