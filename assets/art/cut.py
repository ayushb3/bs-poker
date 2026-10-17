"""Cut the Gemini character sheets into per-character transparent WebPs.

Each sheet is three players side by side on a flat green background, sitting
behind a table. Usage: python cut.py <src-dir> <out-dir>
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

SHEETS = ['opponents', 'smug', 'caught', 'silhouettes', 'woodcut', 'candle', 'moon']
WHO = ['cipher', 'vega', 'onyx']


def key(a, name):
    """Return (rgb, alpha): alpha from green dominance, with green spill removed."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.maximum(r, b)
    d = g - m
    alpha = np.clip(1 - (d - 25) / 50, 0, 1)  # d<=25 opaque, d>=75 clear
    spill = 0.0 if name != 'opponents' and name not in ('smug', 'caught') else 0.15
    a[..., 1] = np.where(g > m, m + (g - m) * np.where(alpha > 0.95, spill, 0.0), g)
    if name in ('silhouettes', 'woodcut', 'moon', 'candle'):
        # smoke and hatching are painted over green; push any leftover green to warm grey
        gr = (a[..., 1] > a[..., 0] * 0.95) & (a[..., 1] > a[..., 2]) & (alpha > 0.05)
        lum = a[..., 0] * 0.3 + a[..., 1] * 0.6 + a[..., 2] * 0.1
        tint = (0.8, 0.86, 1.0) if name == 'moon' else (1.0, 0.86, 0.72)
        for ch, k in enumerate(tint):
            a[..., ch] = np.where(gr, lum * k, a[..., ch])
    return a, alpha


def split_cols(alpha, W):
    col = (alpha[: int(alpha.shape[0] * 0.8)] > 0.5).sum(0)

    def gap(c):
        lo, hi = int(W * (c - 0.08)), int(W * (c + 0.08))
        return lo + int(np.argmin(col[lo:hi]))

    return [0, gap(1 / 3), gap(2 / 3), W]


def cut_piece(rgb, alpha, x0, x1, H):
    a = alpha[:, x0:x1]
    # the table edge under this player: lowest row that still has green beside them
    greenrow = (a < 0.5).mean(1)
    edge = max(i for i in range(H) if greenrow[i] > 0.015)
    cut = edge + int(H * 0.008)
    piece = np.dstack([rgb[:cut, x0:x1], a[:cut] * 255]).clip(0, 255).astype(np.uint8)
    body = edge
    mk = Image.fromarray(((piece[:body, :, 3] > 40) * 255).astype(np.uint8), 'L').copy()
    cy = int(body * 0.6)
    row = np.asarray(mk)[cy]
    cx = int(np.argmin(np.abs(np.arange(len(row)) - len(row) // 2) + (row == 0) * 10**6))
    ImageDraw.floodfill(mk, (cx, cy), 128)
    keep = np.asarray(mk) == 128
    piece[:body, :, 3] = np.where(keep, piece[:body, :, 3], 0)
    kc = keep.any(0)
    bx0, bx1 = int(np.argmax(kc)), len(kc) - int(np.argmax(kc[::-1]))
    piece[body:, :bx0, 3] = 0
    piece[body:, bx1:, 3] = 0
    rows = (piece[..., 3] > 40).any(1)
    top = int(np.argmax(rows))
    piece = piece[max(0, top - 4):, max(0, bx0 - 6):bx1 + 6]
    return Image.fromarray(piece, 'RGBA')


def main(src, out):
    meta = {}
    for name in SHEETS:
        a = np.asarray(Image.open(f'{src}/{name}.jpg').convert('RGB')).astype(np.float32).copy()
        rgb, alpha = key(a, name)
        H, W = alpha.shape
        xs = split_cols(alpha, W)
        meta[name] = {}
        for i, who in enumerate(WHO):
            im = cut_piece(rgb, alpha, xs[i], xs[i + 1], H)
            im.thumbnail((520, 900), Image.LANCZOS)
            im.save(f'{out}/{who}_{name}.webp', 'WEBP', quality=86)
            meta[name][who] = im.size
    t = Image.open(f'{src}/title.jpg')
    t.thumbnail((900, 1700))
    t.save(f'{out}/title.webp', 'WEBP', quality=82)
    print(json.dumps(meta))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
