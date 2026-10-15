# BS Poker

BS Poker, a game by **Samarth**. A bluffing card game: every player holds a small hand, all hands together form a shared pool, and you bid hands you claim exist somewhere in that pool. Raise the bid or call BS. This repo is a browser version you play against 1 to 5 CPU opponents.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173
```

Other scripts: `npm test`, `npm run typecheck`, `npm run build` (output in `dist/`), `npm run preview`.

## Rules in short

Credit for the game and its rules goes to Samarth. Full rules v0.3 and the simulation behind them are in [docs/SPEC.md](docs/SPEC.md).

- 54-card deck. The four 2s and both jokers are **wild**. Natural ranks run 3 through A.
- Everyone starts with 2 cards. All cards in play form the pool, and nobody sees anyone else's hand.
- On your turn, name a specific hand ("pair of 7s", "flush in hearts", "straight to 10") that you claim exists in the pool, higher than the last bid, or call **BS**.
- A bid is higher if its category is higher, or the category is the same and the rank is higher (ties by second rank, or suit for a straight flush).
- On BS the pool is revealed. If the hand exists, the caller takes a card. If not, the bidder does. Impossible bids are allowed as bluffs; calling BS on one always wins.
- The round's loser opens the next one. Reach the card cap (default 6, configurable 4 to 8) and you are out. Last player standing wins.

### The ladder (lowest to highest)

high card < pair < straight < trips < two pair < flush < full house < quads < straight flush < five of a kind

Suits for flush tie-breaks: clubs < diamonds < hearts < spades. The lowest straight is 3-4-5-6-7.

## Layout

- `src/engine/` pure rules engine (bids, `compare`, `exists`, odds, round loop)
- `src/cpu/` easy / medium / hard bots
- `src/app/` app state and controller (no DOM)
- `src/ui/`, `src/style.css`, `index.html` rendering only
- `legacy/`, `docs/bsp*.py` the original Python/JS prototype and simulations (rules v0.2)

See [HANDOFF.md](HANDOFF.md) for decisions, open items and UI redesign seams.
