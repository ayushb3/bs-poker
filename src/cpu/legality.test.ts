import { describe, expect, it } from "vitest";
import { bidsEqual } from "../engine/bids";
import { mulberry32 } from "../engine/deck";
import { cpuDecide, DIFFICULTIES } from "./index";
import { randomContext } from "./testUtil";

describe("cpuDecide legality", () => {
  it("always returns a legal action with a fully populated decision", () => {
    const rng = mulberry32(2024);
    let calls = 0;
    let bids = 0;
    let forcedCalls = 0;
    for (let i = 0; i < 300; i++) {
      const ctx = randomContext(rng);
      for (const difficulty of DIFFICULTIES) {
        const d = cpuDecide({ ...ctx, rng: mulberry32(i * 7 + 1) }, difficulty);
        if (d.action.type === "callBS") {
          expect(ctx.bids.length, `${difficulty} called BS when opening`).toBeGreaterThan(0);
          expect(d.pMyBidExists).toBeNull();
          calls++;
          if (ctx.legalBids.length === 0) forcedCalls++;
        } else {
          const bid = d.action.bid;
          expect(ctx.legalBids.some((b) => bidsEqual(b, bid)), `${difficulty} made an illegal bid`).toBe(true);
          expect(d.pMyBidExists).not.toBeNull();
          expect(d.pMyBidExists).toBeGreaterThanOrEqual(0);
          expect(d.pMyBidExists).toBeLessThanOrEqual(1);
          bids++;
        }
        if (ctx.legalBids.length === 0) expect(d.action.type).toBe("callBS");
        if (ctx.bids.length === 0) expect(d.pCurrentExists).toBeNull();
        else {
          expect(d.pCurrentExists).toBeGreaterThanOrEqual(0);
          expect(d.pCurrentExists).toBeLessThanOrEqual(1);
        }
        expect(typeof d.bluffing).toBe("boolean");
      }
    }
    // Both branches were exercised, including the "nothing left to bid" case.
    expect(calls).toBeGreaterThan(0);
    expect(bids).toBeGreaterThan(0);
    expect(forcedCalls).toBeGreaterThan(0);
  });
});
