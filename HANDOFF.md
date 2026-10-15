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
- **No network at all.** The June prototype used the DiceBear avatar API; the new UI uses emoji "critter" avatars in a gradient ring instead, with the prototype's bot names (Vega, Rook, Sable, Onyx, Lyra, Cipher, Juno, Hawke).
- Phone layout (≤ 720px) puts opponents in a row above a shortened table rather than around the oval; the game log is desktop-only (≥ 1100px).
- "Rematch" (same settings and opponents) is offered on the game-over screen and on the final reveal.
- The human always sits at seat 0. CPU turns are decided immediately and revealed after a 0.7–1.2s skippable delay.
- Settings persist in `localStorage` (best-effort, wrapped in try/catch).
- The "what were the odds" line reports two numbers from the engine: the unconditional chance for that pool size (`bidOdds`, cached, fixed seed, 6000 trials) and the chance seen from the bidder's seat (`estimateExists` conditioned on their hand, 3000 seeded trials), computed once per reveal in the controller and stored as `AppState.odds`.

Process
- Vite 7 / Vitest 4 / TypeScript 5.9 pinned; `.npmrc` sets `legacy-peer-deps=true` because npm 10.9's peer resolution crashes on vitest 4's optional peers.
- Each milestone was a squash-merged PR with CI (typecheck + tests + build) green: #1 M0, #2 M1, #3 M2 (odds line, rematch, settings validation, credit), #4 M2 follow-up (bidder's-seat odds, settings persistence, quit confirm, card glyph fix, screenshots, these docs).
- Two sessions worked on M2 in parallel; #3 landed first and #4 was rebased onto it, keeping #3's structure (`rematch()`, `src/app/settings.ts`, `src/app/reveal.ts`, engine `bidOdds`).

## Unfinished / not verified

- Not tested on real touch devices or Safari; only headless Chromium at 390×844 and 1280×800 (screenshots in `docs/screenshots/`).
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
A redesign should only touch `src/ui/*.ts`, `src/style.css` and `index.html`. Do not edit `src/engine`, `src/cpu` or `src/app`.

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
