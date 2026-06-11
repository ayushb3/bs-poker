# BS Poker — Rules (v0.2)

A bluffing/poker hybrid invented by Samarth. Patent pending 😉. Plays in person or over the phone (no physical deck needed — just tracking). Multi-player or vs CPU.

## Core idea

Players each hold a small hand of cards. All cards in play form a shared **communal pool**. Players bid hands they claim exist *somewhere* in that pool. When someone calls BS, all cards reveal. Whoever was wrong (the bluffer or the bad caller) gets penalized with an extra card next round. First player to hit the card cap is out.

## Setup

- Standard 52-card deck.
- **6 wild cards**: all four 2s + 2 jokers. Each takes any rank and suit.
- N players. Round 1: each player dealt **2 cards**.
- Communal pool = all dealt cards combined (e.g. 4 players × 2 cards = 8-card pool).

## Round flow

1. **Starting player** declares a poker hand they claim exists in the pool. Minimum legal opening = **high card** (always exists; serves as the bidding floor).
2. **Next player** (clockwise) chooses one of:
   - Declare a **strictly higher** hand, OR
   - Call **BS**.
3. Bidding continues until BS is called.
4. On BS, all cards reveal:
   - If the declared hand **does exist** in the pool → **caller** gets +1 card next round.
   - If the declared hand **does not exist** → **declarer** gets +1 card next round.
5. The loser of the round starts the next round.

## Hands

Standard poker order, evaluated against any subset of the pool (so a 6-card straight is declarable once the pool has ≥6 cards). With wild cards, hands easily extend beyond 5 cards:

```
high card < pair < two pair < trips < straight < flush <
full house < quads < straight flush < 5-of-a-kind < ...
```

**Flushes and straight flushes must name the suit.** Because four flushes of the same high card can coexist (one per suit), the declaration has to be specific: "Flush, A high of spades" — not just "Flush, A high." Same for straight flushes. This also means the bidding ladder for flushes has 4× as many rungs.

**Open question:** ranking of extended hands (5-of-a-kind vs straight flush, 6-card straights, etc.). Tentative rule: **compare by length first, then standard rank within length** (a 6-card straight beats any 5-card hand). Cleaner for verbal play.

## Winning / losing

- Reach **6 cards** → eliminated (default; tunable).
- Threshold scales with player count (fewer players → maybe higher cap; calibrate by feel).
- Last player remaining wins.

## Hand-size scaling

After losing a round, the losing player is dealt a new hand at +1 card next round. So the pool grows over time as players accumulate cards. A player at 5 cards facing 3 others at 2 → pool is 11 cards, and bigger hands become declarable.

---

# Probability Reference

Monte Carlo simulation, 200k trials per config. Reading: **P(this hand exists somewhere in the pool)**. Numbers are rounded.

> **The bluff zone is wherever P drops below ~50%.** Above that, declaring is mostly safe. Below it, you're pricing in a real chance of being caught.

## Standard 4-player game (8-card pool, 2 cards each, round 1)

| Hand            | P(exists) |
|-----------------|----------:|
| Pair            |    96.8%  |
| Two pair        |    74.0%  |
| Three of a kind |    61.4%  |
| Straight        |    44.5%  |
| Full house      |    33.9%  |
| Flush           |    26.1%  |
| Quads           |    19.8%  |
| Straight flush  |     7.7%  |
| Five of a kind  |     3.0%  |

**Read:** opening with anything ≤ trips is essentially safe. Two pair is the natural opener. The bluff zone starts at **straight / full house** — that's where caller-vs-declarer becomes a real coin flip. Quads is where bluffs go to die unless you actually have a wild + a real pair already.

## How pool size changes the math

| Pool size            | ≥ Trips | ≥ Straight | ≥ Full house | ≥ Quads | ≥ Straight flush |
|----------------------|--------:|-----------:|-------------:|--------:|-----------------:|
| 4 cards (2p × 2)     |   12.5% |       0.0% |         0.0% |    0.7% |             0.0% |
| 6 cards (3p × 2)     |   36.2% |      14.1% |         9.1% |    6.5% |             1.3% |
| **8 cards (4p × 2)** |   61.4% |      44.5% |        33.9% |   19.8% |             7.7% |
| 10 cards (5p × 2)    |   78.8% |      70.9% |        65.8% |   37.4% |            20.5% |
| 12 cards (6p × 2)    |   88.8% |      86.6% |        86.5% |   54.9% |            38.8% |
| 16 cards (4p × 4)    |   98.0% |      97.8% |        98.0% |   82.3% |            73.2% |
| 20 cards (4p × 5)    |   99.9% |      99.7% |        99.9% |   95.3% |            92.1% |

**Read:**
- More cards in the pool = bidding ladder shifts way up. With 12+ cards, even **quads** is more likely than not to exist.
- Past ~16 cards, basically every standard hand exists. The game *needs* extended hands (6-card straights, 5-of-a-kind, etc.) to keep ladder room.
- This is why hands like **5-of-a-kind** and **6-card straights** matter mechanically — without them, late-game rounds collapse.

## Wild density commentary

6 wilds in 52 cards = **~11.5% wild rate**. In an 8-card pool, expected wilds ≈ 0.92. That's why pair almost always exists (a single wild + any other card = pair). It's also why straight is more common than flush — straights need 5 specific *ranks*, but with wilds + 8 cards there's almost always a window. Flush needs 5 of one *suit*, which is harder despite the wilds.

## Strategic implications

- **Opening bid sweet spot**: two pair / trips for 4-player. Pair is too cheap (everyone knows it exists).
- **Calling BS sweet spot**: when someone declares **straight flush or quads early** in a 4-player game, the math is on your side (~80%+ to be a bluff).
- **Late-round caution**: as the pool grows, every category becomes more real. Stop calling BS on full houses when there are 12+ cards on the table.
- **Wilds tilt the bidding ladder hand-rank-flat**: with so many wilds, *flushes* become genuinely harder than *straights*, contradicting standard poker intuition. Verify this before locking the rank order.

## Open design questions

- [ ] Hand ranking for extended hands (length-first vs rarity-first)
- [ ] Round-1 starter rule (random? youngest? dealer?)
- [ ] Card cap scaling (6 for 4 players → ? for 6 players)
- [ ] Should declaring a 6-card+ hand be allowed even when pool is exactly 5 cards? (I.e., can you bluff a hand the pool *can't possibly contain*?) — probably yes, makes for desperation bluffs
- [ ] Tie-breaking on identical hand types (specify ranks: "pair of 7s" vs "pair of 8s"?)
- [ ] CPU opponent: how does it bid? Probability table above is the basis for a simple bot

## Related

- Liar's Dice (closest analogue — same call-or-raise structure, dice instead of cards)
- Indian poker / Blind Man's Bluff (communal-pool flavor)
