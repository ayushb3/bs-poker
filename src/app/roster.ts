/**
 * Who sits at the table. Three bots have painted portraits (Cipher, Vega,
 * Onyx); they always take the first seats. Tables with 4–5 bots fill the
 * extra chairs with other names that reuse a portrait as an alternate look
 * (variant 1), which the UI renders mirrored and re-graded.
 */
import type { Rng } from "../engine";
import type { Portrait, Seat } from "./state";

export const PORTRAITS: readonly Portrait[] = ["cipher", "vega", "onyx"];

const PORTRAIT_NAME: Record<Portrait, string> = { cipher: "Cipher", vega: "Vega", onyx: "Onyx" };

/** Names for the extra chairs at 4–5 bot tables. */
export const EXTRA_NAMES: readonly string[] = ["Rook", "Sable", "Lyra", "Juno", "Hawke"];

export const HUMAN_SEAT: Seat = { id: 0, name: "You", portrait: null, variant: 0, human: true };

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Seat 0 is the human; bots get distinct names, painted portraits first. */
export function makeSeats(bots: number, rng: Rng): Seat[] {
  const portraits = shuffled(PORTRAITS, rng);
  const extras = shuffled(EXTRA_NAMES, rng);
  const seats: Seat[] = [HUMAN_SEAT];
  for (let i = 0; i < bots; i++) {
    const portrait = portraits[i % portraits.length]!;
    const first = i < portraits.length;
    const name = first ? PORTRAIT_NAME[portrait] : (extras[i - portraits.length] ?? `Bot ${i + 1}`);
    seats.push({ id: i + 1, name, portrait, variant: first ? 0 : 1, human: false });
  }
  return seats;
}
