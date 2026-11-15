#!/usr/bin/env python3
# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Builds terrain products for catalogue sites from a NASA LOLA DEM.

Outputs, per site, under <out>/<site_id>/:
  mask.json        terrain horizon (0.5° azimuth bins) used by the planner and Sky View
  grid.json        masks on a grid around the site for the sensitivity map
  heightmap.json   metadata for the 3D view   + heightmap.bin (float32, little-endian)
  hillshade.png    shaded relief for the map

Example (south pole sites, a polar stereographic LOLA GeoTIFF in metres):
  python3 preprocess/build_site_assets.py --dem LDEM_875S_20M.tif \
      --sites api/data/sites.json --ids shackleton_ridge --out api/data/terrain \
      --product "LOLA LDEM_875S_20M"

Use a DEM whose coverage contains each site; sites outside it are reported and skipped.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lunar_terrain import Dem, grid_masks, hillshade, horizon_mask, local_grid  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dem", required=True, help="DEM file readable by GDAL (GeoTIFF, PDS3 .IMG/.LBL)")
    ap.add_argument("--sites", required=True, help="api/data/sites.json")
    ap.add_argument("--ids", default="", help="comma-separated site ids (default: all south_pole sites)")
    ap.add_argument("--out", required=True, help="api/data/terrain")
    ap.add_argument("--product", default="", help="DEM product name recorded in the metadata")
    ap.add_argument("--units", choices=["m", "km"], default="m", help="DEM height units after scaling")
    ap.add_argument("--scale", type=float, default=None, help="override the DEM scale factor")
    ap.add_argument("--observer-height", type=float, default=2.0, help="metres above the surface (panel/antenna)")
    ap.add_argument("--az-step", type=float, default=0.5)
    ap.add_argument("--max-dist-km", type=float, default=60.0)
    ap.add_argument("--grid-n", type=int, default=3, help="grid half-size: (2n+1)² points")
    ap.add_argument("--grid-spacing", type=float, default=500.0, help="metres between grid points")
    ap.add_argument("--extent-km", type=float, default=20.0, help="map and 3D tile size")
    ap.add_argument("--size", type=int, default=256, help="heightmap and hillshade resolution")
    ap.add_argument("--skip-grid", action="store_true")
    args = ap.parse_args(argv)

    dem = Dem.open(args.dem, units=args.units, scale=args.scale, product=args.product)
    sites = json.loads(Path(args.sites).read_text())["sites"]
    wanted = [s.strip() for s in args.ids.split(",") if s.strip()]
    todo = [s for s in sites if (s["id"] in wanted if wanted else s["region"] == "south_pole")]
    if not todo:
        print("No matching sites.", file=sys.stderr)
        return 1

    for s in todo:
        out = Path(args.out) / s["id"]
        try:
            mask = horizon_mask(dem, s["lat"], s["lon"], observer_height_m=args.observer_height,
                                az_step_deg=args.az_step, max_dist_m=args.max_dist_km * 1000)
        except ValueError as e:
            print(f"[skip] {s['id']}: {e}")
            continue
        out.mkdir(parents=True, exist_ok=True)
        mask["meta"]["site_id"] = s["id"]
        (out / "mask.json").write_text(json.dumps(mask))
        cov = mask["meta"]["rays_fully_covered"]
        print(f"[mask] {s['id']}: skyline {min(mask['elevations']):.2f}° to {max(mask['elevations']):.2f}°, "
              f"rays fully covered {cov:.0%}")

        if not args.skip_grid:
            grid = grid_masks(dem, s["lat"], s["lon"], n=args.grid_n, spacing_m=args.grid_spacing,
                              observer_height_m=args.observer_height, max_dist_m=args.max_dist_km * 1000)
            (out / "grid.json").write_text(json.dumps(grid))
            print(f"[grid] {s['id']}: {len(grid['points'])} points at {args.grid_spacing:.0f} m")

        z, cell = local_grid(dem, s["lat"], s["lon"], args.extent_km * 1000, args.size)
        Image.fromarray(hillshade(z, cell)).save(out / "hillshade.png")
        zf = np.nan_to_num(z, nan=float(np.nanmin(z)) if np.isfinite(z).any() else 0.0).astype("<f4")
        (out / "heightmap.bin").write_bytes(zf.tobytes())
        (out / "heightmap.json").write_text(json.dumps({
            "size": args.size, "extent_m": args.extent_km * 1000, "cell_m": cell,
            "min_m": float(np.nanmin(z)), "max_m": float(np.nanmax(z)),
            "orientation": "row 0 = north edge, column 0 = west edge, site at centre",
            "format": "float32 little-endian, row-major", "product": dem.product,
        }))
        print(f"[tile] {s['id']}: {args.extent_km:.0f} km tile, relief {np.nanmin(z):.0f} to {np.nanmax(z):.0f} m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
