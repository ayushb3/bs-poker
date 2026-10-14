---
type: active
created: 2026-10-14
updated: 2026-10-14
---

# BS Poker — Build Spec

Turns 2026-06-10-bs-poker-rules (Samarth's game, rules v0.2) into an app. **Status:** rules v0.3 locked 2026-10-14 from simulation (below). Next step is M0.

Related: 2026-06-10-bs-poker-rules · portfolio-site-spec (PC box entry, Zoroark) · ideas-backlog

## Decisions (2026-10-14)
- **Credit:** the game was invented by **Samarth**. Credit him in the app and on the portfolio.
- **Bots first.** Ship play-against-CPU (M1) first. Room mode for friends comes later, only if people want it.
- **Start fresh.** The 06-10 prototype isn't needed, because the rules changed enough that its engine would be rewritten anyway. If it turns up on the Mac, its sunset look and critter avatars are worth reusing for the UI. Its code currently sits in the vault only as a bare gitlink at `Personal/bs-poker`.
- **Rules v0.3:** decided by simulation, not by feel. See the next section.

## Rules v0.3: what changed and why

Method: 20k simulated deals per pool size from 6 to 20 cards, with the 54-card deck (52 + 2 jokers, so all four 2s and both jokers are wild). The checker reproduces the v0.2 table to within 0.5 points, so the new numbers are comparable.

**The principle:** a higher bid should always be *less likely* to exist. If a higher bid is actually safer, everyone skips to it and the rungs below it are dead.

### 1. Bids name ranks: "pair of 7s," not "a pair"
With generic bids, the ladder falls apart as the pool grows:

| Pool | Pair | Two pair | Trips | Straight | Full house | Flush |
|---|---:|---:|---:|---:|---:|---:|
| 8 | 97% | 74% | 61% | 44% | 33% | 26% |
| 12 | 100% | 99% | 89% | 87% | 87% | 84% |

By 12 cards, everything up to a full house is near-certain, which is why v0.2 needed 6-card hands. With named bids, the same pools still leave plenty of room, even at 20 cards (where five of a kind is only 28%). It also makes your own hand matter: holding a 7 makes "pair of 7s" a real read. That's the Liar's Dice feel. **Extended hands (6-card straights and so on) are dropped.** They aren't needed anymore.

### 2. The ladder, reordered by rarity
Wilds change which hands are rare. Average P that a *named* bid exists:

| Pool | High card | Pair | Straight | Trips | Two pair | Flush | Full house | Quads | Str. flush | Five of a kind |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 (4p, round 1) | 83% | 47% | 14% | 16% | 10% | 7% | 2% | 3% | 1% | 0.3% |
| 10 | 90% | 60% | 32% | 27% | 21% | 19% | 6% | 7% | 2% | 1% |
| 12 | 94% | 72% | 51% | 39% | 36% | 36% | 14% | 14% | 5% | 3% |
| 16 | 98% | 87% | 82% | 62% | 64% | 69% | 37% | 33% | 18% | 12% |

**Final order, lowest to highest:**
**high card → pair → straight → trips → two pair → flush → full house → quads → straight flush → five of a kind**

That's two moves from standard poker:
- **Straight drops below trips.** With 6 wilds, a straight is more common than trips from 10 cards up. At 8 cards they're about tied (14% vs 16%).
- **Two pair moves above trips.** Two *named* pairs are consistently rarer than named trips.

Leftover inversions are all small (5 points or less) and only show up at the edges:
- Full house vs quads swap places by about 1 point. Standard order is kept.
- Flush passes two pair only past 16 cards.

### 3. Rank cleanup so rank raises stay fair
- **2s are wild, so natural ranks run 3 through A** (12 ranks). The lowest straight is **3-4-5-6-7**. The wheel and the 6-high straight are gone, because their 2-slot can only be filled by a wild, which made them rarer than higher straights.
- **Flushes name a suit only:** "flush in hearts." Naming a high card backfired: an A-high flush was *more* likely than a 9-high one (6.7% vs 0.5%), so raising the rank made the bid safer. Suits rank ♣ < ♦ < ♥ < ♠.
- Inside a category, raising the rank is a free step (same odds), like raising the face in Liar's Dice. Use it to push the bid toward ranks you hold.

### 4. Everything else
| Item | Rule |
|---|---|
| Bids | **High card** `r` · **pair** `r` · **straight** to `h` · **trips** `r` · **two pair** `a` over `b` · **flush** in suit `s` · **full house** `a` over `b` · **quads** `r` · **straight flush** to `h` in `s` · **five of a kind** `r` |
| Raising | Higher category, or same category with a higher rank. Ties within a category go by primary rank, then second rank (or suit for a straight flush). |
| Round-1 starter | Random. After that, the round's loser starts. |
| Card cap | Eliminated at 6 cards by default, configurable from 4 to 8. Pools stay at or under ~20 cards with 4 players, where the ladder still works. |
| Impossible bids | Allowed (desperation bluffs). Calling BS on one always wins. |

## Engine
- **Bid model:** `{category, rank, rank2?, suit?}` plus one `compare(a, b)` that owns the ladder above.
- **`exists(bid, pool)`:** W = number of wilds. A bid exists if the cards it's missing can be covered by wilds:
  - n-of-a-kind: `count(r) + W ≥ n`
  - two pair / full house: `max(0, need₁ − count(a)) + max(0, need₂ − count(b)) ≤ W`
  - straight to h: missing ranks in `h−4 … h` ≤ W
  - flush in s: `count(suit s) + W ≥ 5`
  - straight flush: same as a straight, counting only cards of suit s
- **Tests:** compare `exists` against brute-force enumeration on small pools, and check it reproduces the tables in this note.
- **CPU:** estimates P(bid exists | my hand, pool size) by Monte Carlo over the cards it can't see.
  - **Easy:** uses the static table.
  - **Medium:** conditions on its own hand.
  - **Hard:** also treats earlier bids as weak evidence about other hands.
  - Every level calls BS when P is below its threshold. Otherwise it raises to the cheapest bid it believes, with a bluff rate set by difficulty.

## Stack
- A TypeScript engine as a pure module, ready to share with a server later.
- A static web client: play in the browser, deploy anywhere.
- **Later, room mode:** a small WebSocket server (PartyKit, a Durable Object or plain Node). No accounts, just a room code and a name.

## Milestones
- **M0 — Engine:** bid model, `compare`, `exists`, deal/round loop. Tests green and the tables above reproduced.
- **M1 — vs CPU in the browser:** full game against 1–5 bots on three difficulties. A legal-bid picker that only offers bids above the current one, so there's no typing. A reveal screen that shows which cards made or broke the hand. This is the portfolio version.
- **M2 — Polish:** a "what were the odds" line on every reveal (from the same engine), plus rematch, settings and Samarth's credit on the title screen.
- **M3 — Room mode (later):** 2–6 phones with hidden hands. Only if friends ask for it.

---
_Logged: 2026-10-14_
