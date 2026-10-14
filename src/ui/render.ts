/** Root renderer: rebuilds the screen from AppState on every change. */
import type { App } from "../app/controller";
import type { AppState } from "../app/state";
import { gameScreen } from "./game";
import { helpPanel } from "./help";
import { overScreen } from "./over";
import { revealScreen } from "./reveal";
import { titleScreen } from "./title";

function screenFor(state: AppState, app: App): HTMLElement {
  const { actions } = app;
  const game = state.game;
  switch (state.screen) {
    case "game":
      return game ? gameScreen(state, game, actions) : titleScreen(state, actions);
    case "reveal":
      return game ? revealScreen(state, game, actions) : titleScreen(state, actions);
    case "over":
      return game ? overScreen(state, game, actions) : titleScreen(state, actions);
    default:
      return titleScreen(state, actions);
  }
}

export function mountRenderer(root: HTMLElement, app: App): void {
  let lastScreen: AppState["screen"] | null = null;

  function render(state: AppState): void {
    // Remember which button had focus so keyboard users don't lose their place.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active?.dataset?.["key"] ?? null;

    const frag = document.createDocumentFragment();
    frag.appendChild(screenFor(state, app));
    if (state.showHelp) frag.appendChild(helpPanel(() => app.actions.toggleHelp(false)));
    root.replaceChildren(frag);
    root.dataset["screen"] = state.screen;

    if (state.showHelp) {
      root.querySelector<HTMLElement>('[data-key="help-close"]')?.focus({ preventScroll: true });
    } else if (focusKey) {
      root.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    }
    if (state.screen !== lastScreen) {
      lastScreen = state.screen;
      window.scrollTo({ top: 0 });
    }
  }

  app.subscribe(render);
  render(app.getState());
}
