# BS Poker

A bluffing/poker hybrid card game **invented by Samarth**. Everyone holds a few cards; all hands together form one hidden pool. Players bid poker hands they claim exist somewhere in that pool, raising each time, until someone calls **BS**. Whoever was wrong takes an extra card next round. Reach the card cap and you're out; last player standing wins.

Play it against 1–5 CPU opponents in the browser: take a seat at a candlelit saloon table (the "Saloon" look). A static site, no account, works on a phone; the only network request is Google Fonts.

> Patent pending 😉

▶️ **Play it now:** https://ayushb3.github.io/bs-poker/

📜 **Rules v0.3 and the design rationale:** [docs/SPEC.md](./docs/SPEC.md) (the source of truth). [RULES.md](./RULES.md) is the older v0.2 write-up, kept for history.

## Run it

Requires Node 22+.

```bash
npm ci            # install (uses the lockfile)
npm run dev       # dev server with hot reload, prints a local URL
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build locally
npm test          # engine + CPU tests (vitest)
npm run typecheck # tsc --noEmit
npm run sim       # CPU self-play: win rates and bids per round, printed
```

`dist/` is plain static files built for the `/bs-poker/` base path (see `vite.config.ts`). Every push to `main` deploys it to GitHub Pages via `.github/workflows/deploy.yml`; to host it somewhere else, change `base` to match the new path.

## How to play

1. On the title screen pick the number of opponents (1–5), the CPU difficulty (easy / medium / hard), the card cap (4–8, default 6) and the **bot speed** (Slow / Normal / Fast / Instant; Fast and Instant also shorten the deal and flip animations). Press **Take a seat**. **Hurry them along** skips a bot's thinking at any speed.
2. Round 1 deals everyone 2 cards. A random player opens; after that, the round's loser opens.
3. On your turn, either **raise** (the picker only ever offers bids strictly above the current one, so you can't make an illegal bid) or press **Call BS!** on the last bid.
4. When BS is called, all hands are revealed. The cards that make the claimed hand light up in gold, wilds included. If the hand is there, the caller loses; if not, the bidder loses. The loser is dealt one more card from the next round on.
5. The reveal also shows **what the odds were**: how often that bid exists in a pool of that size, and how likely it looked from the bidder's seat.
6. A player who reaches the card cap is out. Last one in wins. **Play again** rematches with the same table.

### Rules summary (v0.3)

- **Deck:** 54 cards. All four **2s** and both **jokers** are wild (6 wilds). Natural ranks run **3 through A**.
- **Bids name ranks:** "pair of 7s", not "a pair". Flushes name a **suit only** ("flush in ♥"). Straights name their high card; the lowest straight is **3-4-5-6-7**.
- **The ladder, lowest to highest** (ordered by how rare each named bid is with 6 wilds, decided by simulation):

  high card → pair → straight → trips → two pair → flush → full house → quads → straight flush → five of a kind

- **Raising:** a higher category, or the same category with a higher rank (two pair / full house compare the first rank, then the second; flushes compare suits ♣ < ♦ < ♥ < ♠; straight flushes compare high card, then suit).
- **A bid exists** if the cards it is missing can be covered by the wilds in the pool. Impossible bids are allowed as desperation bluffs; BS on one always wins.
- **Losing a round** = +1 card every round after. **Card cap** (default 6) eliminates you. The loser opens the next round; if they were just eliminated, the next player clockwise opens.

### The CPU opponents

All three levels call BS when their estimate of P(current bid exists) drops below a threshold, otherwise raise to the cheapest bid they believe in, with a bluff rate set by difficulty.

| Level | How it estimates | Calls BS below | Bids at | Bluff rate |
|---|---|---:|---:|---:|
| Easy | Static table: P(category exists) by pool size, ignores its own hand, noisy | 30% | 55% | 20% |
| Medium | Monte Carlo over the cards it can't see, conditioned on its own hand | 40% | 60% | 12% |
| Hard | Same, plus earlier bids by others nudge its samples toward hands consistent with those bids; bluffs less, and on ranks it holds | 45% | 65% | 7% |

In seeded self-play, hard beats easy about 96% of heads-up games and medium about two thirds. The numbers live in `src/cpu/params.ts`.

## Project layout

```
src/engine/   pure TypeScript rules engine (no DOM); shared by the UI, the bots and a future server
  types.ts      Card, Bid, GameState … the contract
  bids.ts       compare() owns the ladder; allBids(), legalRaises(), bidLabel()
  exists.ts     exists(bid, pool) and explain() (witness cards for the reveal)
  odds.ts       estimateExists(): Monte Carlo P(bid exists | known cards, pool size)
  game.ts       newGame / applyAction / nextRound round loop, card cap, elimination
  *.test.ts     brute-force oracle for exists(), SPEC table reproduction, game-loop tests
src/cpu/      easy / medium / hard players behind one decide() policy; self-play sim
src/app/      app state, controller (drives engine + bots), odds line, picker logic
src/ui/       vanilla DOM "Saloon" screens: title, table scene (layout.ts seats 1-5 bots), HUD + change-hand sheet, reveal, game over
assets/       art, card faces, props and textures imported by src/ui/assets.ts (only imported files ship)
legacy/       the June 2026 prototype (Python CLI + single-file web UI), kept for reference
docs/         SPEC.md, the simulation scripts behind it, and screenshots
```

Continuous integration (`.github/workflows/ci.yml`) runs typecheck, tests and the build on every pull request and on `main`.

## Credits

- **Card faces:** Dmitry Fomin's "English pattern" playing cards, via Wikimedia Commons, public domain (CC0). Downscaled to WebP in `assets/cards/`. The joker face is drawn in CSS for this project (the Commons joker/back designs are LGPL and are not used).
- **Props and textures:** [Poly Haven](https://polyhaven.com) wooden candlestick model render and old planks texture (table rail), CC0.
- **Character portraits, title painting, saloon wall and card back:** generated with Google Gemini for this project (`assets/art/`; `cut.py` cuts the figures off their green screen).
- **Fonts:** [Rye](https://fonts.google.com/specimen/Rye), [Alegreya Sans and Alegreya Sans SC](https://fonts.google.com/specimen/Alegreya+Sans), SIL Open Font License, served by Google Fonts.

## License

MIT — do whatever, just don't sue me when you lose to your friends.
