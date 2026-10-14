import random
from collections import Counter
exec(open('bsp.py').read().split('CATS=')[0])
def flush_suit(have,s,W): return sum(1 for r in R if (r,s) in have)+W>=5
def ex2(cat,p,W,c,have):
    if cat=='high': return c[p[0]]+W>=1
    if cat=='flush': return flush_suit(have,p[0],W)
    return ex(cat,p,W,c,have)
ORDER=['high','pair','trips','straight','twopair','flush','fullhouse','quads','sflush','five']
def bids(cat):
    if cat in('high','pair','trips','quads','five'): return [(r,) for r in R]
    if cat=='twopair': return [(a,b) for a in R for b in R if a>b]
    if cat=='fullhouse': return [(a,b) for a in R for b in R if a!=b]
    if cat=='straight': return [(h,) for h in range(7,15)]
    if cat=='flush': return [(s,) for s in S]
    if cat=='sflush': return [(h,s) for h in range(7,15) for s in S]
random.seed(2); N=20000
print("named-bid P(exists), avg [min..max] per category; proposed ladder order top->bottom")
for n in (6,8,10,12,16,20):
    spec={k:Counter() for k in ORDER}
    for _ in range(N):
        pool=random.sample(DECK,n); W,c,have=counts(pool)
        for k in ORDER:
            for b in bids(k):
                if ex2(k,b,W,c,have): spec[k][b]+=1
    row=[]
    for k in ORDER:
        v=[spec[k][b]/N for b in bids(k)]; row.append((k,sum(v)/len(v),min(v),max(v)))
    inv=[f"{a[0]}>{b[0]}" for a,b in zip(row,row[1:]) if b[1]>a[1]+0.01]
    print(f"pool {n:2d}: "+"  ".join(f"{k} {a:.0%}" for k,a,_,_ in row)+(f"   INVERSIONS: {inv}" if inv else "   monotone"))
    print("         spread: "+"  ".join(f"{k} {lo:.0%}-{hi:.0%}" for k,_,lo,hi in row if hi-lo>0.02))
