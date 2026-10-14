/**
 * Offline "critter" avatars + the prototype's poker-y bot names.
 * No network: an emoji animal in a gradient circle.
 */
import type { Rng } from "../engine";
import type { Seat } from "./state";

interface Critter {
  readonly name: string;
  readonly critter: string;
  readonly hue: number;
}

export const CRITTERS: readonly Critter[] = [
  { name: "Vega", critter: "🦊", hue: 22 },
  { name: "Rook", critter: "🐻", hue: 200 },
  { name: "Sable", critter: "🦝", hue: 280 },
  { name: "Onyx", critter: "🐸", hue: 140 },
  { name: "Lyra", critter: "🐙", hue: 330 },
  { name: "Cipher", critter: "🦉", hue: 250 },
  { name: "Juno", critter: "🐯", hue: 40 },
  { name: "Hawke", critter: "🐼", hue: 180 },
];

export const HUMAN_SEAT: Seat = { id: 0, name: "You", critter: "😎", hue: 46, human: true };

/** Seat 0 is the human; bots get distinct random critters. */
export function makeSeats(bots: number, rng: Rng): Seat[] {
  const pool = [...CRITTERS];
  const seats: Seat[] = [HUMAN_SEAT];
  for (let i = 1; i <= bots; i++) {
    const pick = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [c] = pool.splice(pick, 1);
    if (!c) break;
    seats.push({ id: i, name: c.name, critter: c.critter, hue: c.hue, human: false });
  }
  return seats;
}
