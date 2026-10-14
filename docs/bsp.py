import random, itertools, sys
from collections import Counter
R=list(range(3,15)); S='shdc'
DECK=[(r,s) for r in R for s in S]+['W']*6   # 2s + jokers = 6 wilds, 54 cards
def counts(pool):
    W=sum(1 for c in pool if c=='W'); nat=[c for c in pool if c!='W']
    return W, Counter(r for r,_ in nat), set(nat)
def straight_ok(have, h, W, L=5, suit=None):
    lo=h-L+1
    if lo<1: return False
    miss=0
    for r in range(lo,h+1):
        rr = 14 if r==1 else r
        if r==2: miss+=1; continue            # rank-2 slot must be a wild
        ok = (rr,suit) in have if suit else any((rr,s) in have for s in S)
        miss += 0 if ok else 1
    return miss<=W
def flush_ok(have,s,h,W,L=5):
    top = 0 if (h,s) in have else 1
    below = sum(1 for r in R if r<h and (r,s) in have)
    return top+max(0,L-1-below)<=W
# specific bids: (cat, params)
def ex(cat,p,W,c,have):
    if cat=='pair': return c[p[0]]+W>=2
    if cat=='twopair': return max(0,2-c[p[0]])+max(0,2-c[p[1]])<=W
    if cat=='trips': return c[p[0]]+W>=3
    if cat=='straight': return straight_ok(have,p[0],W)
    if cat=='flush': return flush_ok(have,p[1],p[0],W)
    if cat=='fullhouse': return max(0,3-c[p[0]])+max(0,2-c[p[1]])<=W
    if cat=='quads': return c[p[0]]+W>=4
    if cat=='sflush': return straight_ok(have,p[0],W,suit=p[1])
    if cat=='five': return c[p[0]]+W>=5
CATS=['pair','twopair','trips','straight','flush','fullhouse','quads','sflush','five']
def bids(cat):
    if cat in('pair','trips','quads','five'): return [(r,) for r in R]
    if cat=='twopair': return [(a,b) for a in R for b in R if a>b]
    if cat=='fullhouse': return [(a,b) for a in R for b in R if a!=b]
    if cat=='straight': return [(h,) for h in range(5,15)]
    if cat in('flush',): return [(h,s) for h in range(7,15) for s in S]
    if cat=='sflush': return [(h,s) for h in range(5,15) for s in S]
N=int(sys.argv[1]) if len(sys.argv)>1 else 20000
random.seed(1)
print("pool | generic P(any exists) / specific P(avg named bid) [min..max over named bids]")
for n in (4,6,8,10,12,16):
    gen=Counter(); spec={k:Counter() for k in CATS}
    for _ in range(N):
        pool=random.sample(DECK,n); W,c,have=counts(pool)
        for k in CATS:
            any_=False
            for b in bids(k):
                if ex(k,b,W,c,have): spec[k][b]+=1; any_=True
            gen[k]+=any_
    print(f"--- pool {n}")
    for k in CATS:
        v=[spec[k][b]/N for b in bids(k)]
        print(f"  {k:10s} generic {gen[k]/N:6.1%}   named avg {sum(v)/len(v):6.1%}  [{min(v):5.1%}..{max(v):5.1%}]")
