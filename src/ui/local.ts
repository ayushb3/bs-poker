/** UI-only state that the app controller doesn't need to know about (open sheets). */
export interface LocalState {
  /** The "Change hand" sheet is open. */
  readonly sheet: boolean;
}

let local: LocalState = { sheet: false };
let rerender: () => void = () => {};

export function getLocal(): LocalState {
  return local;
}

export function setLocal(patch: Partial<LocalState>): void {
  local = { ...local, ...patch };
  rerender();
}

/** Reset without re-rendering (used inside a render pass). */
export function resetLocal(patch: Partial<LocalState>): void {
  local = { ...local, ...patch };
}

export function onLocalChange(fn: () => void): void {
  rerender = fn;
}
