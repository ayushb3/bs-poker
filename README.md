# BS Poker

A bluffing/poker hybrid card game invented by Samarth. Players each hold a small hand. All cards together form a shared **communal pool**. Players bid hands they claim exist *somewhere* in the pool. Next player declares higher — or calls **BS**. Whoever's wrong gets penalized with an extra card next round.

> Patent pending 😉

📜 **Full rules:** [RULES.md](./RULES.md) — includes Monte Carlo probability tables.

## Two ways to play

### 🌅 Web UI (sunset theme, animated cards, custom avatars)

```bash
python3 -m http.server 8767
# Open http://localhost:8767/index.html
```

Or just open `index.html` directly in any modern browser.

Features:
- Sunset gradient over a green-felt poker table
- Opponents arranged around the rim (DiceBear avatars + poker-y names)
- Custom avatar picker (9 styles, click your face to change)
- Help/cheat-sheet panel (top-left `?`)
- Skip button to fast-forward CPU thinking
- Witness highlighting on reveal — when BS is called and the hand exists, the cards that prove it light up in gold

### 💻 CLI (Python, stdlib only, no install)

```bash
python3 bs_poker.py                              # 1 human, 3 medium CPUs
python3 bs_poker.py --players 5 --difficulty hard
python3 bs_poker.py --humans 0                   # CPU-only demo
```

## Input formats (during your turn — CLI)

Type one of these to declare a hand:
- `7 high`, `A high`
- `pair of 9s`, `pair 9`, `pair of aces`
- `two pair K Q`, `two pair Ks and Qs`
- `trips 7`, `three of a kind 7`
- `straight to 10`, `straight to A`
- `flush A spades`, `flush K high of hearts`
- `full house 8 over 3`, `full house 8s over 3s`
- `quads K`, `four of a kind K`
- `straight flush 9 of spades`
- `5oak A`, `five of a kind A`

Other commands:
- `bs` / `call` / `bullshit` — call BS on the current declaration
- `help` / `?` — list legal upgrades from the current declaration

## How the CPU plays

Each CPU runs a small Monte Carlo simulation each turn (~600 trials), conditioned on the cards it actually holds, to estimate **P(declared hand exists in the pool)**:
- **Calls BS** when current declaration's conditional probability falls below a threshold.
- **Declares** the strongest hand whose probability is above the safety threshold (with a small chance of bidding one rung lower to avoid telegraphing strength).

Difficulty thresholds:
- `easy`   — declare ≥0.55, call BS <0.30
- `medium` — declare ≥0.65, call BS <0.40
- `hard`   — declare ≥0.75, call BS <0.50

Harder = bids more aggressively, calls BS more often.

## Files

- `index.html` — single-file web UI (sunset theme, vanilla JS, no build step)
- `bs_poker.py` — CLI version: deck, hand checking, CPU strategy, game loop, text parser
- `RULES.md` — full rules + Monte Carlo probability tables
- `README.md` — this file

## Architecture quick map

| Function/class | Purpose |
|---|---|
| `make_deck()` | 52 cards + 6 wilds (4 twos + 2 jokers) |
| `Declaration` | Frozen dataclass for a specific hand bid; comparable; has `label()` |
| `ALL_DECS` | All ~340 legal declarations sorted weakest-to-strongest |
| `hand_exists(pool, dec)` | Does this declaration exist in this pool, given wilds? |
| `findWitnessIds()` (JS) | Which specific cards prove the declared hand? |
| `CPU.choose_action(...)` | Return `("declare", dec)` or `("bs", None)` |
| `parse_human_declaration(...)` | Free-form text → Declaration |
| `play_round(...)` | One round: deal, bid loop, BS resolution |
| `play_game(...)` | Outer loop: rounds until one player remains |

## License

MIT — do whatever, just don't sue me when you lose to your friends.
