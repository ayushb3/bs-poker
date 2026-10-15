# Handoff

## Status
M0 (engine), M1 (play vs CPU in the browser) and M2 (odds line, rematch, settings, credit) are done. M3 (room mode) is not started and only worth building if friends ask.

## Decisions
- Rules v0.3 from docs/SPEC.md: named bids, reordered ladder, 2s and jokers wild, 54-card deck.
- Credit line on the title screen: "BS Poker, a game by Samarth."
- "What were the odds" is `bidOdds(bid, poolSize)` in `src/engine/odds.ts`: unconditional P(that exact bid exists) in a pool of that size, Monte Carlo with a fixed seed (6000 trials) and a cache, so it is deterministic. It is computed when BS is called and stored as `AppState.oddsLine`. It does not use anyone's hand.
- Settings (bots 1..5, card cap 4..8 default 6, difficulty) already existed on the title screen from M1. M2 moved the validation into `src/app/settings.ts` (`validateSettings`), which clamps and rejects unknown difficulties.
- "Play again" became `rematch()`: same settings, same opponents, fresh game; clears log, flash, picker and odds line.
- Logic that lived in `src/ui/` moved to `src/app/reveal.ts`: reveal wording (`revealText`), the odds text (`oddsLine`) and final standings order (`standings`). What remains in `src/ui/` is layout, labels and DOM.
- No restyle in M2: no CSS changed; the odds line reuses the existing `.odds-line` class.

## Unfinished / not done
- No visual redesign (planned in a separate session).
- Room mode (M3).
- The odds line is Monte Carlo, so it can be off by about a point; it is deterministic, not exact.
- Not browser-tested by a human beyond the automated tests and build.
- Legacy Python CLI and prototype are kept under `legacy/` and `docs/` for reference, not maintained.

## UI redesign seams
A redesign should only touch `src/ui/*.ts`, `src/style.css` and `index.html`. Do not edit `src/engine`, `src/cpu` or `src/app`.

Entry: `src/main.ts` calls `createApp()` then `mountRenderer(root, app)` (`src/ui/render.ts`), which re-renders the whole screen from `AppState` on every change.

State the UI reads (`AppState`, `src/app/state.ts`):
- `screen`: "title" | "game" | "reveal" | "over"; `showHelp`
- `settings`: `{ bots, difficulty, cardCap }`; limits `MIN_BOTS`, `MAX_BOTS`, `MIN_CAP`, `MAX_CAP`; `DIFFICULTIES` from `src/cpu`
- `game`: engine `GameState` (players, hands, bids, phase, turn, `lastResult`, `winner`, config)
- `seats`: names, critter, hue (seat 0 is the human)
- `picker`: current selection; derive the visible options with `derivePicker` (`src/app/picker.ts`)
- `thinking`, `flash`, `log`, `oddsLine`

Actions the UI calls (`Actions`, `src/app/controller.ts`):
`setSettings(patch)`, `toggleHelp(show?)`, `startGame()`, `rematch()`, `changeSettings()`, `pickCategory`, `pickRank`, `pickRank2`, `pickSuit`, `confirmBid()`, `callBS()`, `skipThinking()`, `nextRound()`.

Text helpers for screens: `revealText`, `oddsLine`, `standings` in `src/app/reveal.ts`; engine helpers `bidLabel`, `rankLabel`, `suitSymbol`, `cardLabel`, `legalActions`, `poolOf`, `explain`.

Per screen: title `ui/title.ts`, table `ui/game.ts` + `ui/picker.ts`, reveal `ui/reveal.ts`, game over `ui/over.ts`, help `ui/help.ts`. Shared: `ui/dom.ts` (`h`, `button`), `ui/cards.ts`, `ui/avatars.ts`, `ui/particles.ts`. Keep `data-key` on buttons so focus survives re-render.
