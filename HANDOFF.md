# Handoff

Built autonomously on 2026-10-14/15 from `docs/SPEC.md` (rules v0.3). Milestones M0 (engine), M1 (vs-CPU web game) and M2 (polish) are on `main`. M3 (room mode) was out of scope and nothing was started for it.

## Decisions made without a human

Rules and engine
- **Spec wins over RULES.md** everywhere they differ (ladder order, named bids, flush-by-suit, no extended hands).
- **Elimination is "reaching" the cap** (card count ≥ cap), as RULES.md phrases it. A player eliminated by a round keeps their hand through that round's reveal screen and is dealt out from the next round.
- **When the round's loser was just eliminated**, the next active player clockwise from them opens the next round.
- **`startingCards` must be below `cardCap`** (otherwise everyone would be out after round 1). Starting hand size is fixed at 2 in the UI.
- **Out-of-range bid shapes are rejected** (e.g. a straight to 6, which cannot exist with 2s wild); **impossible-but-well-formed bids are allowed** (five aces in a 6-card pool), per the spec's desperation-bluff rule.
- The engine's `lastResult` is cleared when the next round is dealt; the UI reads it on the reveal screen before moving on.
- Bid labels: "Three of a kind, 9s" / "Four of a kind, 9s" / "Five of a kind, Qs"; "Two pair, As over 9s"; "Full house, Ks over 4s"; "Flush in ♥"; "Straight flush to 9 in ♠".

CPU
- One shared policy with three belief models (static table / own-hand Monte Carlo / own hand + bid evidence). Thresholds in `src/cpu/params.ts`; hard's "jump" rate was raised to 0.30 so all-hard tables don't drag on (~5 bids per round at 4 players).
- Hard's "weak evidence" is implemented as: for each earlier bid by someone else this round, with probability 0.35 force one matching natural card into the unseen part of each Monte Carlo sample. Bidder card counts are not used to weight this.
- The static table for easy is recomputed at module load with a fixed seed rather than hard-coded from the spec (it matches the spec rows within a few points and covers pool sizes the spec table doesn't).

UI
- Superseded by the Saloon redesign (see the end of this file).
- "Rematch" (same settings and opponents) is offered on the game-over screen and on the final reveal.
- The human always sits at seat 0. CPU turns are decided immediately and revealed after a 0.7–1.2s skippable delay.
- Settings persist in `localStorage` (best-effort, wrapped in try/catch).
- The "what were the odds" line reports two numbers from the engine: the unconditional chance for that pool size (`bidOdds`, cached, fixed seed, 6000 trials) and the chance seen from the bidder's seat (`estimateExists` conditioned on their hand, 3000 seeded trials), computed once per reveal in the controller and stored as `AppState.odds`.

Process
- Vite 7 / Vitest 4 / TypeScript 5.9 pinned; `.npmrc` sets `legacy-peer-deps=true` because npm 10.9's peer resolution crashes on vitest 4's optional peers.
- Each milestone was a squash-merged PR with CI (typecheck + tests + build) green: #1 M0, #2 M1, #3 M2 (odds line, rematch, settings validation, credit), #4 M2 follow-up (bidder's-seat odds, settings persistence, quit confirm, card glyph fix, screenshots, these docs).
- Two sessions worked on M2 in parallel; #3 landed first and #4 was rebased onto it, keeping #3's structure (`rematch()`, `src/app/settings.ts`, `src/app/reveal.ts`, engine `bidOdds`).

## Unfinished / not verified

- Not tested on real touch devices or Safari; only headless Chromium at 390×844 and 1280×800 (screenshots in `docs/screenshots/`, retaken for the Saloon redesign).
- No sound, no animations beyond the prototype's deal/pulse/embers, no undo.
- CPU strength was tuned by self-play, not against humans. Easy may still feel too strong or too weak; the knobs are in `src/cpu/params.ts` and `npm run sim` prints win rates.
- The two-pair / full-house pickers show every legal second rank; on a phone that is two rows of chips, which is the tallest the picker gets.
- M3 room mode: the engine is pure and serialisable (`GameState` is plain data, randomness is injected), so a server can drive it, but nothing has been built.

## What a human should check by playing

1. Play a full 4-player game on medium on a phone. Does the picker ever feel like it offers a bid you couldn't make, or hides one you could? (It is driven only by the engine's `legalRaises`.)
2. On a reveal, do the gold cards convince you? Especially: a flush made with wilds, a straight with a gap filled by a joker, and a failed bid where the "short by N" summary should match what you see.
3. Does the odds line feel honest? Compare a few against the table in `docs/SPEC.md` §2.
4. Lose on purpose until you're eliminated: your cards should still show on that reveal, the next round should start with the right player, and the game-over screen should list you as out.
5. Try 5 bots with cap 8: pools get big (20+ cards). Rounds should still end in a handful of bids rather than everyone raising forever.
6. Hard vs easy should be noticeably different: easy bids things it can't see and calls BS on safe bids more often.

## UI redesign seams
A redesign should mostly touch `src/ui/*.ts`, `src/style.css` and `index.html`. Do not edit `src/engine`, `src/cpu` or `src/app`.

Entry: `src/main.ts` calls `createApp()` then `mountRenderer(root, app)` (`src/ui/render.ts`), which re-renders the whole screen from `AppState` on every change.

State the UI reads (`AppState`, `src/app/state.ts`):
- `screen`: "title" | "game" | "reveal" | "over"; `showHelp`
- `settings`: `{ bots, difficulty, cardCap }`; limits `MIN_BOTS`, `MAX_BOTS`, `MIN_CAP`, `MAX_CAP`; `DIFFICULTIES` from `src/cpu`
- `game`: engine `GameState` (players, hands, bids, phase, turn, `lastResult`, `winner`, config)
- `seats`: names, critter, hue (seat 0 is the human)
- `picker`: current selection; derive the visible options with `derivePicker` (`src/app/picker.ts`)
- `thinking`, `flash`, `log`, `odds` (format with `formatOdds` from `src/app/odds.ts`), `opener`, `confirmQuit`

Actions the UI calls (`Actions`, `src/app/controller.ts`):
`setSettings(patch)`, `toggleHelp(show?)`, `startGame()`, `rematch()`, `changeSettings()`, `confirmQuit(show)`, `pickCategory`, `pickRank`, `pickRank2`, `pickSuit`, `confirmBid()`, `callBS()`, `skipThinking()`, `nextRound()`.

Text helpers for screens: `revealText`, `standings` in `src/app/reveal.ts`, `formatOdds` in `src/app/odds.ts`, `settingsSummary` in `src/app/state.ts`; engine helpers `bidLabel`, `rankLabel`, `suitSymbol`, `cardLabel`, `legalActions`, `poolOf`, `explain`.

Per screen: title `ui/title.ts`, table `ui/game.ts` + `ui/picker.ts`, reveal `ui/reveal.ts`, game over `ui/over.ts`, help `ui/help.ts`. Shared: `ui/dom.ts` (`h`, `button`), `ui/cards.ts`, `ui/avatars.ts`, `ui/particles.ts`. Keep `data-key` on buttons so focus survives re-render.

## Saloon redesign (2026-10-16)

The UI was rebuilt to the "Saloon" mockups (RDR2-style, candlelit). Engine and CPU are untouched.

- **Stage.** Everything is laid out on a 390px-wide stage (`ui/stage.ts`) scaled to the window: phones fill the width (height flexes, min 700 logical px, `.short` below 780); wider screens get a centred phone column at 844px over a blurred wall backdrop. The scene block (figures, table, claim) shifts by `--off` as the height changes; header/feed are top-anchored, hand/HUD bottom-anchored.
- **Seats.** `ui/layout.ts` places 1–5 figures along the far rail (projected from the CSS perspective table), evenly spaced, non-overlapping, bottoms tucked under the rail; tested in `layout.test.ts`.
- **Characters.** Only Cipher, Vega and Onyx have art. `makeSeats` now always seats those three first; 4th/5th bots get other names (Rook, Sable, Lyra, Juno, Hawke) and reuse a portrait as `variant: 1`, drawn mirrored and re-graded. `Seat` lost `critter`/`hue` and gained `portrait`/`variant`.
- **Moods.** `revealMood` (app/reveal.ts): loser of the call is `caught`, winner `smug`, everyone else neutral. Image mapping is the single `PORTRAIT_ART` table in `ui/assets.ts`; smug/caught use the painted art until candlelit versions exist.
- **Picker.** ‹ › walk the engine's ascending legal raises (`stepBid` in app/picker.ts, `actions.stepBid`), the parchment button confirms, "Change hand" opens a sheet with hand type / rank / second rank / suit (still driven by `derivePicker`). `actions.pickBid(bid)` selects an exact legal bid.
- **Reveal.** Short odds readout via `shortOdds` (app/odds.ts); the long `formatOdds` sentence is kept (tested) but no longer shown. Outcome line via `outcomeText`.
- **Not done / approximations:** no sound; alternate-look bots are mirrored recolours rather than new characters; the painted smug/caught art is brighter than the candlelit seated art; the Vega smug cut-out has a small leftover patch on its left edge.
