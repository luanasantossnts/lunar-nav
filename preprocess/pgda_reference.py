#!/usr/bin/env python3
# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Long-term reference values from NASA PGDA product 69 (Lunar Polar Illumination,
Mazarico et al. 2011): average Sun and Earth visibility over ~18.6 years of hourly
time steps, and the permanently shadowed regions (PSR), for each catalogue site.

For every site, in the finest product that covers it:
  - value at the site (bilinear),
  - P10 / median / P90 of the pixels within 300 m and within 1 km,
  - fraction of PSR pixels within 300 m and within 1 km.
Writes <out>/<site_id>.json.

The GeoTIFFs are tiled, so only the few tiles around each site are read, over HTTP
(GDAL /vsicurl/), unless --local points to a folder with the same file names.

  python3 preprocess/pgda_reference.py --sites api/data/sites.json --out api/data/pgda
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window

BASE_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/"
PRODUCT_PAGE = "https://pgda.gsfc.nasa.gov/products/69"
MOON_R = 1_737_400.0
GEO = CRS.from_proj4(f"+proj=longlat +R={MOON_R} +no_defs +type=crs")
# South polar products, finest first: (name, southern edge of full coverage, metres per pixel).
PRODUCTS = [("85S_060M", -85.0, 60), ("75S_120M", -75.0, 120), ("65S_240M", -65.0, 240)]
CRITERION = {
    "sun": "percentage of timesteps where each pixel was sunlit (by any fraction of the solar disc)",
    "earth": "percentage of timesteps where each pixel was sunlit (by any fraction of the Earth disc)",
}
CITATION = ("Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). "
            "Illumination conditions of the lunar polar regions using LOLA topography. Icarus 211, 1066-1081. "
            "doi:10.1016/j.icarus.2010.10.030")


def product_for(lat: float):
    for name, edge, res in PRODUCTS:
        if lat <= edge:
            return name, res
    return None, None


def stats(values: np.ndarray) -> dict:
    """P10, median and P90 (numpy linear percentiles) of finite values; None when empty."""
    v = values[np.isfinite(values)]
    if v.size == 0:
        return {"p10": None, "median": None, "p90": None, "pixels": 0}
    p10, med, p90 = np.percentile(v, [10, 50, 90])
    return {"p10": round(float(p10), 4), "median": round(float(med), 4), "p90": round(float(p90), 4), "pixels": int(v.size)}


def disc_mask(shape, centre_rc, radius_px):
    """Boolean mask of pixel centres within radius_px of a fractional (row, col) centre."""
    rr, cc = np.mgrid[0:shape[0], 0:shape[1]]
    return np.hypot(rr - centre_rc[0], cc - centre_rc[1]) <= radius_px


def read_around(path: str, lat: float, lon: float, half_m: float):
    """Window of scaled values around a site, its fractional centre and the projected pixel size."""
    with rasterio.open(path) as src:
        x, y = Transformer.from_crs(GEO, src.crs, always_xy=True).transform(lon % 360.0, lat)
        row, col = src.index(x, y, op=float)
        px = abs(src.transform.a)
        half = int(math.ceil(half_m / px)) + 2
        r0, c0 = int(math.floor(row)) - half, int(math.floor(col)) - half
        win = Window(c0, r0, 2 * half + 1, 2 * half + 1).intersection(Window(0, 0, src.width, src.height))
        raw = src.read(1, window=win, masked=True).astype("float64")
        scale = src.scales[0] if src.scales else 1.0
        offset = src.offsets[0] if src.offsets else 0.0
        data = (raw * scale + offset).filled(np.nan)
        # Pixel-centre coordinates: index() gives the fractional position of (x, y) in pixel units,
        # where integer + 0.5 is a pixel centre.
        return data, (row - win.row_off - 0.5, col - win.col_off - 0.5), px


def bilinear(data, rc):
    r, c = rc
    r0, c0 = int(math.floor(r)), int(math.floor(c))
    fr, fc = r - r0, c - c0
    q = data[r0:r0 + 2, c0:c0 + 2]
    if q.shape != (2, 2) or not np.isfinite(q).all():
        return None
    return float(q[0, 0] * (1 - fr) * (1 - fc) + q[0, 1] * (1 - fr) * fc + q[1, 0] * fr * (1 - fc) + q[1, 1] * fr * fc)


def site_reference(site: dict, root: str) -> dict:
    lat, lon = site["lat"], site["lon"]
    prod, res = product_for(lat)
    if prod is None:
        return {"site_id": site["id"], "available": False, "reason": "outside the PGDA south polar products (65°S–90°S)"}
    # Polar stereographic true at the pole: projected metres = ground metres × k.
    k = 2.0 / (1.0 + math.sin(math.radians(abs(lat))))
    files = {"sun": f"AVGVISIB_{prod}_201608.TIF", "earth": f"AVGVISIB_{prod}_201608_EARTH.TIF", "psr": f"LPSR_{prod}_201608.TIF"}
    out = {"site_id": site["id"], "available": True, "lat": lat, "lon": lon}
    for key, fname in files.items():
        data, rc, px = read_around(root + fname, lat, lon, 1000.0 * k)
        r300 = disc_mask(data.shape, rc, 300.0 * k / px)
        r1k = disc_mask(data.shape, rc, 1000.0 * k / px)
        if key == "psr":
            psr = data > 0.5
            valid = np.isfinite(data)
            out["psr"] = {
                "at_site": bool(psr[int(round(rc[0])), int(round(rc[1]))]),
                "fraction_300m": round(float(psr[r300 & valid].mean()) if (r300 & valid).any() else 0.0, 4),
                "fraction_1km": round(float(psr[r1k & valid].mean()) if (r1k & valid).any() else 0.0, 4),
            }
        else:
            v = bilinear(data, rc)
            out[key] = {"at_site": None if v is None else round(v, 4), "within_300m": stats(data[r300]), "within_1km": stats(data[r1k])}
    out["product"] = {
        "name": f"NASA PGDA 69 · LOLA {files['sun'].replace('.TIF', '')} / _EARTH / LPSR_{prod}_201608",
        "version": "V1.05 (2016-09-15)",
        "resolution_m": res,
        "period": "≈18.6 years (one lunar nutation cycle), hourly time steps",
        "units": "fraction of time steps (0–1)",
        "criterion": CRITERION,
        "observer": "at the DEM surface (no height above ground stated in the product labels)",
        "files": {k2: BASE_URL + v2 for k2, v2 in files.items()},
        "page": PRODUCT_PAGE,
        "citation": CITATION,
    }
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sites", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--ids", default="", help="comma-separated site ids (default: every south site within 65°S–90°S)")
    ap.add_argument("--local", default="", help="folder with the PGDA GeoTIFFs (default: read over HTTP)")
    args = ap.parse_args(argv)
    root = (args.local.rstrip("/") + "/") if args.local else "/vsicurl/" + BASE_URL
    sites = json.loads(Path(args.sites).read_text())["sites"]
    wanted = [s.strip() for s in args.ids.split(",") if s.strip()]
    todo = [s for s in sites if (s["id"] in wanted if wanted else s["lat"] <= PRODUCTS[-1][1])]
    Path(args.out).mkdir(parents=True, exist_ok=True)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF", GDAL_HTTP_MAX_RETRY="3"):
        for s in todo:
            ref = site_reference(s, root)
            (Path(args.out) / f"{s['id']}.json").write_text(json.dumps(ref, ensure_ascii=False, indent=1))
            if ref["available"]:
                print(f"[pgda] {s['id']}: {ref['product']['resolution_m']} m · Sun {ref['sun']['at_site']} (300 m median {ref['sun']['within_300m']['median']}) · "
                      f"Earth {ref['earth']['at_site']} · PSR 300 m {ref['psr']['fraction_300m']} / 1 km {ref['psr']['fraction_1km']}")
            else:
                print(f"[skip] {s['id']}: {ref['reason']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
