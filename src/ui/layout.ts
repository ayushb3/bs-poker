/**
 * Seat geometry for the Saloon table, in stage pixels. The stage is a
 * 390px-wide phone frame; scene coordinates assume the 844px reference height
 * and are shifted as a block on shorter/taller screens (see stage.ts).
 *
 * Figures are anchored by their bottom edge just below the table rail so the
 * rail hides their forearms; they spread evenly along the far side of the oval
 * and never overlap.
 */

export const STAGE_W = 390;
export const REF_H = 844;

/** The perspective table: box in scene coordinates and its plane size. */
export const TABLE = { left: 5, top: 250, width: 380, height: 330, tilt: 54, perspective: 720 } as const;

/**
 * Visual (projected) y of the table's far rail at stage x: the outer edge of
 * the oval after rotateX(tilt) under the wrapper's perspective, sampled.
 */
export function railTopAt(x: number): number {
  const cx = TABLE.left + TABLE.width / 2;
  const cy = TABLE.top + TABLE.height / 2;
  const rx = TABLE.width / 2;
  const ry = TABLE.height / 2;
  const t = (TABLE.tilt * Math.PI) / 180;
  const dx = x - cx;
  let best = cy;
  let bestErr = Infinity;
  for (let i = 0; i <= 360; i++) {
    const th = Math.PI + (Math.PI * i) / 360; // far half of the oval
    const u = rx * Math.cos(th);
    const v = ry * Math.sin(th); // negative: away from the viewer
    const scale = TABLE.perspective / (TABLE.perspective - v * Math.sin(t));
    const sx = u * scale;
    const err = Math.abs(sx - dx);
    if (err < bestErr) {
      bestErr = err;
      best = cy + v * Math.cos(t) * scale;
    }
  }
  return best;
}

export interface SeatSpot {
  /** Figure centre x and width (stage px). */
  readonly cx: number;
  readonly w: number;
  /** y of the figure's bottom edge (hidden under the rail). */
  readonly bottom: number;
  /** Where this seat's face-down cards sit, in the table plane (pre-rotation px). */
  readonly tx: number;
  readonly ty: number;
  /** Width of the face-down cards on the table. */
  readonly backW: number;
  /** Width of the face-up cards on the reveal. */
  readonly revealW: number;
  /** Horizontal room for this seat's revealed hand. */
  readonly slot: number;
}

/** Figure widths by opponent count: shrink for 4-5 so they fit side by side. */
const WIDTH: Record<number, number> = { 1: 132, 2: 128, 3: 124, 4: 96, 5: 76 };

export function seatSpots(n: number): SeatSpot[] {
  const count = Math.max(1, Math.min(5, n));
  const base = WIDTH[count] ?? 76;
  // Centres: evenly spaced columns, but 1-2 opponents sit nearer the middle.
  const margin = count === 1 ? 195 : count === 2 ? 118 : base / 2 + 2;
  const span = STAGE_W - 2 * margin;
  const spots: SeatSpot[] = [];
  for (let i = 0; i < count; i++) {
    const cx = count === 1 ? 195 : margin + (span * i) / (count - 1);
    const off = Math.abs(cx - STAGE_W / 2) / (STAGE_W / 2); // 0 centre .. 1 edge
    // Far (centre) figures are a touch smaller: they sit further back.
    const w = Math.round(base * (0.95 + 0.05 * off));
    // +16 tucks the forearms under the rail; the extra term covers the rail's
    // thickness toward the ends of the oval (measured in the browser).
    const bottom = Math.round(railTopAt(cx) + 16 + 18 * off * off);
    const tx = TABLE.width / 2 + (cx - STAGE_W / 2) * 0.85;
    const ty = Math.min(150, 40 + 72 * ((tx - TABLE.width / 2) / 112) ** 2);
    const slot = count <= 3 ? 110 : STAGE_W / count;
    spots.push({ cx, w, bottom, tx, ty, backW: count <= 3 ? 34 : 26, revealW: count <= 3 ? 40 : 30, slot });
  }
  return spots;
}

/** Horizontal step between overlapping cards so `count` cards of width `w` fit in `room`. */
export function fanStep(count: number, w: number, room: number, max: number): number {
  if (count <= 1) return 0;
  return Math.max(4, Math.min(max, (room - w) / (count - 1)));
}
