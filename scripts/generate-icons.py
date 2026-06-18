#!/usr/bin/env python3
"""
Stardust Ticket — Icon Generator
=================================
Rasterizes the ticket stub mark to all required PWA / favicon sizes.

Mark anatomy:
  Canvas: square (NxN)
  Ticket body: portrait rounded rect, left-offset (leaves space for notch)
  Right-side notch: semicircle "bite" from right edge at vertical center
  Inner window: rounded rect inset within body (transparent — bg color shows)

Color scheme (monochrome):
  BG:   #0a0a0a  (--color-bg)
  Mark: #ededed  (--color-tx)

Usage:
  pip install pillow numpy
  python scripts/generate-icons.py

Outputs:
  public/icons/icon-192.png   PWA icon
  public/icons/icon-512.png   PWA icon (maskable)
  public/icons/icon-180.png   Apple touch icon
  public/favicon-16.png       Favicon (tiny)
  public/favicon-32.png       Favicon (standard)
  public/favicon-48.png       Favicon (large)
  src/app/favicon.ico         Multi-size ICO (16+32+48)
  public/favicon.ico          Same, for static serving
"""

import os
import struct
from io import BytesIO

try:
    from PIL import Image, ImageDraw
    import numpy as np
except ImportError:
    raise SystemExit("Missing deps. Run: pip install pillow numpy")

BG   = (10, 10, 10, 255)    # #0a0a0a
MARK = (237, 237, 237, 255) # #ededed


def draw_mark(size: int) -> Image.Image:
    """
    Full-quality mark for sizes >= 64px.
    Rendered at 4x then downscaled for clean anti-aliasing.
    """
    S  = size
    sc = 4
    T  = S * sc

    # ── Geometry (all in final px, multiplied by sc when drawing) ──
    bw  = round(S * 0.68)
    bh  = round(S * 0.86)
    bx  = round(S * 0.06)
    by  = (S - bh) // 2
    brx = max(3, round(S * 0.10))

    ncx = bx + bw           # notch center: right edge of body
    ncy = S // 2
    nr  = round(S * 0.13)

    bdr = round(S * 0.09)   # border thickness for inner window
    wx  = bx + bdr
    wy  = by + bdr
    ww  = bw - bdr * 2
    wh  = bh - bdr * 2
    wrx = max(2, round(S * 0.06))

    def rr_mask(x, y, w, h, r) -> np.ndarray:
        m = Image.new('L', (T, T), 0)
        d = ImageDraw.Draw(m)
        d.rounded_rectangle([x*sc, y*sc, (x+w)*sc, (y+h)*sc], radius=r*sc, fill=255)
        return np.array(m.resize((S, S), Image.LANCZOS), dtype=np.float32) / 255.0

    def circ_mask(cx, cy, r) -> np.ndarray:
        m = Image.new('L', (T, T), 0)
        d = ImageDraw.Draw(m)
        d.ellipse([(cx-r)*sc, (cy-r)*sc, (cx+r)*sc, (cy+r)*sc], fill=255)
        return np.array(m.resize((S, S), Image.LANCZOS), dtype=np.float32) / 255.0

    body   = rr_mask(bx, by, bw, bh, brx)
    notch  = circ_mask(ncx, ncy, nr)
    window = rr_mask(wx, wy, ww, wh, wrx)

    alpha = np.clip(body - notch - window, 0, 1)

    r_ch = np.full((S, S), MARK[0], dtype=np.uint8)
    g_ch = np.full((S, S), MARK[1], dtype=np.uint8)
    b_ch = np.full((S, S), MARK[2], dtype=np.uint8)
    a_ch = (alpha * 255).astype(np.uint8)

    mark_img = Image.fromarray(np.stack([r_ch, g_ch, b_ch, a_ch], axis=2), 'RGBA')
    bg = Image.new('RGBA', (S, S), BG)
    bg.alpha_composite(mark_img)
    return bg


def draw_mark_small(size: int) -> Image.Image:
    """Simplified mark for 16–48px — bolder strokes, no numpy needed."""
    S = size
    im = Image.new('RGBA', (S, S), BG)
    d = ImageDraw.Draw(im)

    if S <= 16:
        bx, by, bw, bh = 1, 1, 11, 14
        d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=2, fill=MARK)
        ncx, ncy, nr = bx+bw, by+bh//2, 2
        d.ellipse([ncx-nr, ncy-nr, ncx+nr, ncy+nr], fill=BG)
        return im

    bx  = round(S * 0.06)
    bw  = round(S * 0.68)
    bh  = round(S * 0.86)
    by  = (S - bh) // 2
    brx = max(2, round(S * 0.09))
    d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=brx, fill=MARK)

    ncx = bx + bw
    ncy = S // 2
    nr  = round(S * 0.13)
    d.ellipse([ncx-nr, ncy-nr, ncx+nr, ncy+nr], fill=BG)

    bdr = max(2, round(S * 0.09))
    d.rounded_rectangle(
        [bx+bdr, by+bdr, bx+bw-bdr, by+bh-bdr],
        radius=max(1, brx-2), fill=BG
    )
    return im


def make_ico(pairs: list) -> bytes:
    """Pack PIL images into a multi-size .ico file."""
    num = len(pairs)
    header = struct.pack('<HHH', 0, 1, num)

    png_chunks = []
    for _, im in pairs:
        buf = BytesIO()
        im.save(buf, format='PNG')
        png_chunks.append(buf.getvalue())

    offset = 6 + 16 * num
    entries = b''
    for (sz, _), data in zip(pairs, png_chunks):
        w = sz if sz < 256 else 0
        entries += struct.pack('<BBBBHHII', w, w, 0, 0, 1, 32, len(data), offset)
        offset += len(data)

    return header + entries + b''.join(png_chunks)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root  = os.path.dirname(script_dir)
    icons_dir  = os.path.join(repo_root, 'public', 'icons')
    public_dir = os.path.join(repo_root, 'public')
    app_dir    = os.path.join(repo_root, 'src', 'app')

    os.makedirs(icons_dir, exist_ok=True)

    print('Generating Stardust Ticket icons...\n')

    for size in (192, 512, 180):
        path = os.path.join(icons_dir, f'icon-{size}.png')
        draw_mark(size).save(path, 'PNG', optimize=True)
        print(f'  ✓  public/icons/icon-{size}.png')

    for size in (16, 32, 48):
        path = os.path.join(public_dir, f'favicon-{size}.png')
        draw_mark_small(size).save(path, 'PNG', optimize=True)
        print(f'  ✓  public/favicon-{size}.png')

    ico_pairs = [(s, draw_mark_small(s)) for s in (16, 32, 48)]
    ico_bytes = make_ico(ico_pairs)

    for dest in [os.path.join(app_dir, 'favicon.ico'), os.path.join(public_dir, 'favicon.ico')]:
        with open(dest, 'wb') as f:
            f.write(ico_bytes)
        rel = dest.replace(repo_root + '/', '')
        print(f'  ✓  {rel}  (16+32+48 multi-size ICO)')

    print('\n✅ Done.\n')
    print('Add to src/app/manifest.ts:')
    print('  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },')
    print('  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },')
    print('  { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },')


if __name__ == '__main__':
    main()
