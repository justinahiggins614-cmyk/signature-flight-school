#!/usr/bin/env python3
"""Flight School training-region terrain tiles.

Generates assets/terrain/sig/{z}/{x}/{y}.jpg — the SAME slippy-map tile
scheme as Signature Earth (Web Mercator, z/x/y, 256px) — for the sim's
training region (Swiss-Alps-like: lat 44.5-48.5, lon 6-10).

Source: Signature Earth's assets/earth-texture.png (NASA Blue Marble NG,
public domain, Signature-binary transform). Legal: same public-domain
source, our own tiling.

The sim samples these at runtime for real-imagery ground color
(LOD by altitude); where tiles are missing it falls back to the
procedural training terrain. Re-run: python3 code/make_terrain_tiles.py
"""
import os, math, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "/home/hatch/workspace/signature-earth/assets/earth-texture.png"
OUT = os.path.join(ROOT, "assets", "terrain", "sig")
T = 256
ZOOMS = (5, 6, 7, 8)
LAT0, LAT1 = 44.5, 48.5   # south, north
LON0, LON1 = 6.0, 10.0    # west, east

def lonlat_to_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    lr = math.radians(lat)
    y = (1.0 - math.log(math.tan(lr) + 1.0 / math.cos(lr)) / math.pi) / 2.0 * n
    return x, y

def main():
    im = Image.open(SRC).convert("RGB")
    sw, sh = im.size
    src = np.asarray(im).astype(np.float32)
    # equirectangular: lon -180..180 -> 0..sw ; lat 90..-90 -> 0..sh
    jj, ii = np.mgrid[0:T, 0:T].astype(np.float64)
    count = 0
    for z in ZOOMS:
        n = 2 ** z
        x0 = max(0, int(math.floor((LON0 + 180) / 360 * n)))
        x1 = min(n - 1, int(math.floor((LON1 + 180) / 360 * n)))
        _, yt_n = lonlat_to_xy(0, LAT1, z)
        _, yt_s = lonlat_to_xy(0, LAT0, z)
        y0 = max(0, int(math.floor(yt_n)))
        y1 = min(n - 1, int(math.floor(yt_s)))
        for x in range(x0, x1 + 1):
            lon = (x + ii / T) / n * 360.0 - 180.0
            for y in range(y0, y1 + 1):
                my_top = math.pi * (1 - 2 * y / n)
                my_bot = math.pi * (1 - 2 * (y + 1) / n)
                my = my_top + (jj + 0.5) / T * (my_bot - my_top)
                lat = np.degrees(np.arctan(np.sinh(my)))
                sx = ((lon + 180.0) / 360.0 * sw).astype(np.int32)
                sy = ((90.0 - lat) / 180.0 * sh).astype(np.int32)
                np.clip(sx, 0, sw - 1, out=sx)
                np.clip(sy, 0, sh - 1, out=sy)
                tile = src[sy, sx].astype(np.uint8)
                d = os.path.join(OUT, str(z), str(x))
                os.makedirs(d, exist_ok=True)
                Image.fromarray(tile).save(os.path.join(d, str(y) + ".jpg"),
                                           quality=72, optimize=True)
                count += 1
    print("wrote %d tiles -> %s" % (count, OUT))

if __name__ == "__main__":
    main()
