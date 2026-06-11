"""
BS Poker — playable CLI prototype.

Rules: see /Users/I589687/Documents/WorkNotes/Personal/2026-06-10-bs-poker-rules.md

Run:  python3 bs_poker.py
      python3 bs_poker.py --players 4 --cap 6 --difficulty medium

Core mechanic: declare a hand you claim exists somewhere in the communal pool
(everyone's cards combined). Next player declares strictly higher or calls BS.
On BS: reveal pool. If hand exists -> caller takes +1 card next round.
       If not -> declarer takes +1 card next round.  Loser of round starts next.
Reach <cap> cards => eliminated. Last player standing wins.

Wild cards: four 2s + two jokers = 6 wilds. Each takes any rank/suit.
"""

import argparse
import random
import sys
from collections import Counter
from dataclasses import dataclass, field
from itertools import combinations
from typing import Optional

# ----- Cards / deck ---------------------------------------------------------

WILD_RANK = -1                                # internal sentinel for wild cards
RANKS = list(range(3, 15))                    # 3..14 (Ace=14). Twos are wild.
SUITS = ["♣", "♦", "♥", "♠"]
RANK_NAME = {r: str(r) for r in range(3, 11)} | {11: "J", 12: "Q", 13: "K", 14: "A"}


def card_str(card):
    r, s = card
    if r == WILD_RANK:
        return "🃏" if s == -1 else f"2{SUITS[s]}"   # joker vs two
    return f"{RANK_NAME[r]}{SUITS[s]}"


def make_deck():
    deck = [(r, s) for r in RANKS for s in range(4)]
    # The four 2s are wild — represent them as wilds with their original suit
    # so reveals look natural; ranking treats them as any rank.
    deck += [(WILD_RANK, s) for s in range(4)]    # 2♣ 2♦ 2♥ 2♠
    deck += [(WILD_RANK, -1), (WILD_RANK, -1)]    # two jokers
    return deck


# ----- Hand categories ------------------------------------------------------
# Categories ordered low -> high. We extend standard poker with a 5-of-a-kind tier.
# Within each category, we also rank by the "rank value" of the hand (e.g. pair of 7s
# < pair of 8s). For straights/flushes we rank by the high card.

CAT_HIGH = 0
CAT_PAIR = 1
CAT_TWO_PAIR = 2
CAT_TRIPS = 3
CAT_STRAIGHT = 4
CAT_FLUSH = 5
CAT_FULL_HOUSE = 6
CAT_QUADS = 7
CAT_STRAIGHT_FLUSH = 8
CAT_FIVE = 9

CAT_NAMES = {
    CAT_HIGH: "High card",
    CAT_PAIR: "Pair",
    CAT_TWO_PAIR: "Two pair",
    CAT_TRIPS: "Three of a kind",
    CAT_STRAIGHT: "Straight",
    CAT_FLUSH: "Flush",
    CAT_FULL_HOUSE: "Full house",
    CAT_QUADS: "Four of a kind",
    CAT_STRAIGHT_FLUSH: "Straight flush",
    CAT_FIVE: "Five of a kind",
}


@dataclass(frozen=True, order=True)
class Declaration:
    """A specific hand a player declares. Comparable: higher means stronger.

    Ordering tuple: (category, primary_rank, secondary_rank)
        - High card / Pair / Trips / Quads / 5oak / Straight / SF / Flush:
            primary = high rank, secondary = 0
        - Two pair: primary = high pair, secondary = low pair
        - Full house: primary = trips rank, secondary = pair rank
    """
    category: int
    primary: int = 0
    secondary: int = 0

    def label(self) -> str:
        rn = RANK_NAME
        c = self.category
        if c == CAT_HIGH:
            return f"{rn[self.primary]} high"
        if c == CAT_PAIR:
            return f"Pair of {rn[self.primary]}s"
        if c == CAT_TWO_PAIR:
            return f"Two pair, {rn[self.primary]}s and {rn[self.secondary]}s"
        if c == CAT_TRIPS:
            return f"Three of a kind, {rn[self.primary]}s"
        if c == CAT_STRAIGHT:
            return f"Straight to {rn[self.primary]}"
        if c == CAT_FLUSH:
            return f"Flush, {rn[self.primary]} high"
        if c == CAT_FULL_HOUSE:
            return f"Full house, {rn[self.primary]}s over {rn[self.secondary]}s"
        if c == CAT_QUADS:
            return f"Four of a kind, {rn[self.primary]}s"
        if c == CAT_STRAIGHT_FLUSH:
            return f"Straight flush to {rn[self.primary]}"
        if c == CAT_FIVE:
            return f"Five of a kind, {rn[self.primary]}s"
        return "?"


def all_declarations():
    """Enumerate every legal Declaration in ascending order."""
    out = []
    # High card 3..A
    for r in RANKS:
        out.append(Declaration(CAT_HIGH, r))
    # Pair 3..A
    for r in RANKS:
        out.append(Declaration(CAT_PAIR, r))
    # Two pair: high > low
    for hi in RANKS:
        for lo in RANKS:
            if lo < hi:
                out.append(Declaration(CAT_TWO_PAIR, hi, lo))
    # Trips
    for r in RANKS:
        out.append(Declaration(CAT_TRIPS, r))
    # Straights — high card = top of 5-card window. Wheel (A-2-3-4-5) high=5.
    for high in [5] + list(range(7, 15)):    # 5-high (wheel) up to A-high
        out.append(Declaration(CAT_STRAIGHT, high))
    # Flush by high card
    for r in RANKS:
        out.append(Declaration(CAT_FLUSH, r))
    # Full house: trips > pair (distinct ranks). Wilds let us bid any combo.
    for trips in RANKS:
        for pair in RANKS:
            if pair != trips:
                out.append(Declaration(CAT_FULL_HOUSE, trips, pair))
    # Quads
    for r in RANKS:
        out.append(Declaration(CAT_QUADS, r))
    # Straight flush
    for high in [5] + list(range(7, 15)):
        out.append(Declaration(CAT_STRAIGHT_FLUSH, high))
    # Five of a kind
    for r in RANKS:
        out.append(Declaration(CAT_FIVE, r))
    out.sort()
    return out


ALL_DECS = all_declarations()


# ----- Hand existence checks (with wilds) -----------------------------------

def _straight_high_in_ranks(unique_ranks: set, wilds: int, high: int) -> bool:
    """Does a 5-card straight ending at `high` exist using ranks + wilds?"""
    if high == 5:
        # Wheel A-2-3-4-5 = {14,2,3,4,5}. Real twos don't exist (all wild),
        # so 2 is always a "missing" slot — wild fills it.
        needed = {14, 2, 3, 4, 5}
    else:
        needed = set(range(high - 4, high + 1))
    missing = needed - unique_ranks
    return len(missing) <= wilds


def _split_pool(pool):
    wilds = sum(1 for c in pool if c[0] == WILD_RANK)
    real = [c for c in pool if c[0] != WILD_RANK]
    return real, wilds


def hand_exists(pool, dec: Declaration) -> bool:
    """Does `dec` (a specific Declaration) exist somewhere in the pool?"""
    real, wilds = _split_pool(pool)
    rank_counts = Counter(r for r, _ in real)
    cat = dec.category

    if cat == CAT_HIGH:
        # "X high" exists if the pool's highest available rank >= X.
        # With wilds, any rank up to A is achievable, so high card of A always exists
        # whenever pool is nonempty. Generally: any X is achievable iff
        # max(real_rank, wilds_promote_to_anything) >= X. With ≥1 wild, any high.
        if wilds >= 1:
            return True
        return any(r >= dec.primary for r, _ in real)

    if cat == CAT_PAIR:
        r = dec.primary
        return rank_counts[r] + wilds >= 2

    if cat == CAT_TWO_PAIR:
        hi, lo = dec.primary, dec.secondary
        # Need 2 of hi AND 2 of lo, drawing from real + wilds (no card double-used)
        need = max(0, 2 - rank_counts[hi]) + max(0, 2 - rank_counts[lo])
        return need <= wilds

    if cat == CAT_TRIPS:
        return rank_counts[dec.primary] + wilds >= 3

    if cat == CAT_STRAIGHT:
        return _straight_high_in_ranks(set(rank_counts.keys()), wilds, dec.primary)

    if cat == CAT_FLUSH:
        # 5 cards of one suit, with high card == dec.primary.
        # Existence: some suit has ≥5 cards (real-of-suit + wilds), AND that suit's
        # max rank (after wild promotion) >= dec.primary. Wilds can be promoted to
        # any rank including dec.primary, so:
        for s in range(4):
            ranks_of_suit = [r for r, ss in real if ss == s]
            if len(ranks_of_suit) + wilds >= 5:
                # Can the high card reach dec.primary?
                # Either a real card of that suit has rank ≥ primary, or we promote
                # a wild to be dec.primary in that suit.
                if wilds >= 1 or any(r >= dec.primary for r in ranks_of_suit):
                    return True
        return False

    if cat == CAT_FULL_HOUSE:
        trips, pair = dec.primary, dec.secondary
        need = max(0, 3 - rank_counts[trips]) + max(0, 2 - rank_counts[pair])
        return need <= wilds

    if cat == CAT_QUADS:
        return rank_counts[dec.primary] + wilds >= 4

    if cat == CAT_STRAIGHT_FLUSH:
        for s in range(4):
            ranks_of_suit = {r for r, ss in real if ss == s}
            if _straight_high_in_ranks(ranks_of_suit, wilds, dec.primary):
                return True
        return False

    if cat == CAT_FIVE:
        return rank_counts[dec.primary] + wilds >= 5

    return False


# ----- Probability table (precomputed via simulation) ------------------------

def _estimate_prob(pool_size: int, dec: Declaration, n_trials=8000) -> float:
    deck = make_deck()
    hits = 0
    for _ in range(n_trials):
        random.shuffle(deck)
        pool = deck[:pool_size]
        if hand_exists(pool, dec):
            hits += 1
    return hits / n_trials


# ----- CPU strategy ---------------------------------------------------------

@dataclass
class CPU:
    name: str
    difficulty: str = "medium"     # easy / medium / hard
    # Cached probability lookups: (pool_size, dec) -> P(exists)
    _prob_cache: dict = field(default_factory=dict)

    def _prob(self, pool_size: int, dec: Declaration) -> float:
        key = (pool_size, dec.category, dec.primary, dec.secondary)
        if key not in self._prob_cache:
            # Quick estimate. For speed, fewer trials at runtime.
            self._prob_cache[key] = _estimate_prob(pool_size, dec, n_trials=3000)
        return self._prob_cache[key]

    def _conditional_prob(self, my_hand, pool_size: int, dec: Declaration,
                          n_trials=3000) -> float:
        """P(dec exists in pool | my_hand is part of the pool).
        Conditioning on what the CPU actually holds is the single biggest CPU upgrade."""
        deck = make_deck()
        # Remove my_hand cards from deck for sampling the OTHERS' cards
        remaining = list(deck)
        for c in my_hand:
            remaining.remove(c)
        others_size = pool_size - len(my_hand)
        if others_size < 0:
            return 1.0 if hand_exists(my_hand, dec) else 0.0
        hits = 0
        for _ in range(n_trials):
            random.shuffle(remaining)
            others = remaining[:others_size]
            pool = list(my_hand) + others
            if hand_exists(pool, dec):
                hits += 1
        return hits / n_trials

    def thresholds(self):
        # (declare_threshold, call_bs_threshold)
        # declare: bid the cheapest hand whose conditional P >= this threshold
        # call_bs: call BS if the current declaration's conditional P < this threshold
        return {
            "easy":   (0.55, 0.30),
            "medium": (0.65, 0.40),
            "hard":   (0.75, 0.50),
        }[self.difficulty]

    def choose_action(self, my_hand, pool_size: int, current_dec: Optional[Declaration]):
        """Return either ('declare', Declaration) or ('bs', None)."""
        declare_t, call_t = self.thresholds()

        # Find legal next declarations
        if current_dec is None:
            candidates = list(ALL_DECS)
        else:
            candidates = [d for d in ALL_DECS if d > current_dec]

        if not candidates:
            return ("bs", None)   # nothing higher possible — must call

        # If there's a current declaration, evaluate calling BS first
        if current_dec is not None:
            p_exists = self._conditional_prob(my_hand, pool_size, current_dec)
            if p_exists < call_t:
                return ("bs", None)

        # Find STRONGEST declaration with high enough probability — bidding low is
        # a waste of turns and signals weakness. Walk from strongest down to first
        # safe bid, then add a small "value buffer" so we don't always max out.
        # When opening (current_dec is None), search a smaller subset for speed.
        search_pool = candidates if current_dec is not None else candidates
        # Iterate in descending strength
        best_safe = None
        for dec in reversed(search_pool):
            # Skip the absurdly strong ones quickly with a fast unconditional prob
            p = self._conditional_prob(my_hand, pool_size, dec, n_trials=800)
            if p >= declare_t:
                best_safe = dec
                break
        if best_safe is not None:
            # Optional: bid slightly below best_safe to keep ammo for later turns.
            idx = search_pool.index(best_safe)
            # 60% bid the strongest safe hand; 40% bid a step lower if available
            if idx > 0 and random.random() < 0.4:
                return ("declare", search_pool[idx - 1])
            return ("declare", best_safe)
        # Nothing safe — bluff the cheapest legal next declaration (strict-higher rule)
        return ("declare", candidates[0])


# ----- Game loop ------------------------------------------------------------

@dataclass
class Player:
    name: str
    is_human: bool
    hand_size: int = 2          # cards held for next round
    cpu: Optional[CPU] = None
    hand: list = field(default_factory=list)   # current round's cards
    eliminated: bool = False


def deal_round(players, deck):
    random.shuffle(deck)
    idx = 0
    for p in players:
        if p.eliminated:
            p.hand = []
            continue
        p.hand = deck[idx:idx + p.hand_size]
        idx += p.hand_size
    pool = []
    for p in players:
        if not p.eliminated:
            pool.extend(p.hand)
    return pool


def show_pool(players):
    print("\n" + "=" * 60)
    print("REVEAL — communal pool:")
    for p in players:
        if p.eliminated:
            continue
        cards = " ".join(card_str(c) for c in p.hand)
        print(f"  {p.name:<12} ({len(p.hand)} cards): {cards}")
    print("=" * 60)


def parse_human_declaration(raw: str, current: Optional[Declaration]) -> Optional[Declaration]:
    """Parse user input into a Declaration. Returns None on failure."""
    raw_orig = raw
    raw = raw.strip().lower()
    if not raw:
        return None
    # quick aliases
    # NOTE: bare "a" is ambiguous with the article ("pair of aces" → "pair", "of",
    # "aces"). We accept "ace"/"aces"/"as"/"A" (case-distinguished by token presence)
    # but require the user to use one of those forms, not bare "a".
    rank_map = {"j": 11, "q": 12, "k": 13, "ace": 14, "aces": 14,
                "as": 14, "king": 13, "kings": 13,
                "queen": 12, "queens": 12, "jack": 11, "jacks": 11}
    # Special: capital "A" in original input means Ace; lowercase "a" is the article.
    has_capital_A = any(t.strip(",.") == "A" for t in raw_orig.split())
    def rank(tok):
        tok = tok.strip().lower()
        if tok in rank_map: return rank_map[tok]
        if tok == "a" and has_capital_A: return 14
        # Strip trailing plural 's' on rank words/numbers: "9s" -> "9", "Ks" -> "K"
        if tok.endswith("s") and len(tok) > 1:
            stripped = tok[:-1]
            if stripped in rank_map: return rank_map[stripped]
            try:
                n = int(stripped)
                if 3 <= n <= 14: return n
            except ValueError:
                pass
        try:
            n = int(tok)
            if 3 <= n <= 14: return n
            if n == 1: return 14
        except ValueError:
            pass
        return None

    tokens = raw.replace(",", " ").split()
    # Strip filler words that aren't ranks themselves
    FILLER = {"of", "the", "an", "to", "over", "and"}
    if not has_capital_A:
        FILLER = FILLER | {"a"}
    tokens = [t for t in tokens if t.lower() not in FILLER]

    def make(cat, prim, sec=0):
        return Declaration(cat, prim, sec)

    # Highest first to disambiguate ("five of a kind 7" before "five high"... etc.)
    if "five of a kind" in raw or "5oak" in raw or "5 of a kind" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_FIVE, r)
    if "straight flush" in raw or "sf" in raw.split():
        # straight flush to X
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_STRAIGHT_FLUSH, r)
    if "quads" in raw or "four of a kind" in raw or "4oak" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_QUADS, r)
    if "full house" in raw or "boat" in raw or "fh" in raw.split():
        ranks_found = [rank(t) for t in tokens if rank(t)]
        if len(ranks_found) >= 2:
            return make(CAT_FULL_HOUSE, ranks_found[0], ranks_found[1])
    if "flush" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_FLUSH, r)
        return make(CAT_FLUSH, 14)  # default A-high
    if "straight" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_STRAIGHT, r)
        return make(CAT_STRAIGHT, 14)
    if "two pair" in raw or "2 pair" in raw:
        ranks_found = [rank(t) for t in tokens if rank(t)]
        if len(ranks_found) >= 2:
            hi, lo = max(ranks_found[:2]), min(ranks_found[:2])
            return make(CAT_TWO_PAIR, hi, lo)
    if "three of a kind" in raw or "trips" in raw or "3oak" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_TRIPS, r)
    if "pair" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_PAIR, r)
    if "high" in raw:
        for t in tokens:
            r = rank(t)
            if r: return make(CAT_HIGH, r)
    return None


def human_turn(player: Player, pool_size: int, current_dec: Optional[Declaration]) -> tuple:
    print(f"\n{player.name} — your hand: {' '.join(card_str(c) for c in player.hand)}")
    print(f"Pool size: {pool_size} cards.  Cards held: {len(player.hand)}")
    if current_dec is not None:
        print(f"Current declaration: {current_dec.label()}")
        print("Type 'bs' to call, or declare a higher hand.")
    else:
        print("You start. Declare a hand (any legal hand).")
    print("Examples: 'pair of 7s', 'two pair Q J', 'straight to A',")
    print("          'full house 8 over 3', 'flush A', 'quads K', '5oak A', 'straight flush 9'")
    while True:
        raw = input("> ").strip()
        if raw.lower() in ("bs", "call", "bullshit"):
            if current_dec is None:
                print("Can't call BS on the first turn — make a declaration.")
                continue
            return ("bs", None)
        if raw.lower() in ("help", "?"):
            print("\nLegal upgrades from here:")
            upgrades = [d for d in ALL_DECS if (current_dec is None or d > current_dec)]
            for d in upgrades[:25]:
                print(f"  - {d.label()}")
            if len(upgrades) > 25:
                print(f"  ... and {len(upgrades) - 25} more")
            continue
        dec = parse_human_declaration(raw, current_dec)
        if dec is None:
            print("Couldn't parse. Try e.g. 'pair of 8', 'straight to 10', 'help' to list upgrades.")
            continue
        if current_dec is not None and dec <= current_dec:
            print(f"Must be strictly higher than {current_dec.label()}. Try again.")
            continue
        return ("declare", dec)


def play_round(players, starter_idx, deck, verbose=True):
    """Play one round. Returns (loser_idx, declared_dec, was_bluff, pool)."""
    # Deal
    pool = deal_round(players, deck)

    # Show CPU/players what's relevant
    if verbose:
        active = [p for p in players if not p.eliminated]
        print("\n" + "─" * 60)
        print(f"NEW ROUND — pool size: {len(pool)} cards "
              f"({', '.join(f'{p.name}={p.hand_size}' for p in active)})")
        print("─" * 60)

    # Bidding loop
    active = [i for i, p in enumerate(players) if not p.eliminated]
    if not active:
        return None
    # Find starter index in active list
    if starter_idx not in active:
        # starter eliminated mid-game — pick next active
        starter_idx = active[0]
    turn = active.index(starter_idx)

    current_dec: Optional[Declaration] = None
    last_declarer_idx = None

    while True:
        pi = active[turn]
        player = players[pi]

        if player.is_human:
            action, dec = human_turn(player, len(pool), current_dec)
        else:
            action, dec = player.cpu.choose_action(player.hand, len(pool), current_dec)
            if verbose:
                if action == "declare":
                    print(f"  {player.name}: \"{dec.label()}\"")
                else:
                    print(f"  {player.name}: BS!")

        if action == "bs":
            # Resolve
            if current_dec is None:
                # impossible (we don't allow it from CPU; human guarded above)
                continue
            exists = hand_exists(pool, current_dec)
            if verbose:
                show_pool(players)
                print(f"\n{player.name} called BS on \"{current_dec.label()}\".")
                if exists:
                    print(f"  ✓ Hand DOES exist. {player.name} loses the round (+1 card).")
                else:
                    print(f"  ✗ Hand does NOT exist. "
                          f"{players[last_declarer_idx].name} loses the round (+1 card).")
            loser = pi if exists else last_declarer_idx
            return (loser, current_dec, not exists, pool)

        # Declared
        current_dec = dec
        last_declarer_idx = pi
        turn = (turn + 1) % len(active)


def play_game(n_players=4, n_humans=1, cap=6, difficulty="medium", verbose=True):
    players = []
    for i in range(n_humans):
        players.append(Player(name=f"You" if n_humans == 1 else f"You{i+1}", is_human=True))
    for i in range(n_players - n_humans):
        cpu_name = f"CPU-{i+1}"
        players.append(Player(name=cpu_name, is_human=False,
                              cpu=CPU(name=cpu_name, difficulty=difficulty)))

    deck = make_deck()
    starter_idx = random.randrange(n_players)
    round_num = 0

    while True:
        active = [i for i, p in enumerate(players) if not p.eliminated]
        if len(active) <= 1:
            break
        round_num += 1
        if verbose:
            print(f"\n\n========== ROUND {round_num} ==========")
            print("Card counts: " + ", ".join(
                f"{p.name}={p.hand_size}" + ("(out)" if p.eliminated else "")
                for p in players))
        result = play_round(players, starter_idx, deck, verbose=verbose)
        if result is None:
            break
        loser_idx, _, _, _ = result
        loser = players[loser_idx]
        loser.hand_size += 1
        if loser.hand_size >= cap:
            loser.eliminated = True
            if verbose:
                print(f"\n💀 {loser.name} hit {cap} cards — eliminated.\n")
        starter_idx = loser_idx if not loser.eliminated else (
            [i for i, p in enumerate(players) if not p.eliminated] or [0]
        )[0]

    winner = next((p for p in players if not p.eliminated), None)
    if verbose:
        print("\n" + "=" * 60)
        if winner:
            print(f"🏆  {winner.name} WINS!")
        else:
            print("Game over — no winner (everyone eliminated simultaneously?)")
        print("=" * 60)
    return winner


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--players", type=int, default=4, help="Total players (incl. you)")
    ap.add_argument("--humans", type=int, default=1, help="Human players (0 = CPU-only demo)")
    ap.add_argument("--cap", type=int, default=6, help="Card count to be eliminated")
    ap.add_argument("--difficulty", choices=["easy", "medium", "hard"], default="medium")
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    print("BS Poker — CLI prototype")
    print(f"  {args.players} players ({args.humans} human, "
          f"{args.players - args.humans} CPU at {args.difficulty})")
    print(f"  Eliminated at {args.cap} cards.\n")
    play_game(n_players=args.players, n_humans=args.humans,
              cap=args.cap, difficulty=args.difficulty, verbose=True)


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nQuit.")
        sys.exit(0)
