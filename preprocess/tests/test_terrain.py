# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Terrain tests on synthetic DEMs in a lunar south polar stereographic projection.
Run: python3 -m pytest preprocess/tests -q
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lunar_terrain as lt  # noqa: E402
import build_site_assets  # noqa: E402

POLAR = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
PIX = 100.0
HALF = 40_000.0


def write_dem(path, fn):
    n = int(2 * HALF / PIX)
    xs = -HALF + PIX * (np.arange(n) + 0.5)
    ys = HALF - PIX * (np.arange(n) + 0.5)
    X, Y = np.meshgrid(xs, ys)
    Z = fn(X, Y).astype("float32")
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="float32",
                       crs=POLAR, transform=from_origin(-HALF, HALF, PIX, PIX), nodata=-32768) as dst:
        dst.write(Z, 1)
    return path


@pytest.fixture
def flat(tmp_path):
    return lt.Dem.open(str(write_dem(tmp_path / "flat.tif", lambda X, Y: np.zeros_like(X))))


@pytest.fixture
def walled(tmp_path):
    # A 500 m high plateau for x > 5 km: seen from the pole, a wall to one side.
    return lt.Dem.open(str(write_dem(tmp_path / "wall.tif", lambda X, Y: np.where(X > 5000, 500.0, 0.0))))


def az_of_plus_x(lat, lon):
    """Azimuth from (lat, lon) toward the +x direction of the projection, measured numerically."""
    d = lt.destination(lat, lon, np.arange(0, 360, 1.0), 1000.0)
    from pyproj import Transformer
    t = Transformer.from_crs(lt.MOON_GEOGRAPHIC, POLAR, always_xy=True)
    x, _ = t.transform(d[1], d[0])
    return float(np.arange(0, 360, 1.0)[int(np.argmax(x))])


def test_flat_horizon_is_the_sphere_dip(flat):
    m = lt.horizon_mask(flat, -89.99, 0.0, observer_height_m=2.0, max_dist_m=30_000)
    dip = -math.degrees(math.acos(lt.MOON_RADIUS_M / (lt.MOON_RADIUS_M + 2.0)))
    assert max(m["elevations"]) == pytest.approx(dip, abs=0.01)
    assert min(m["elevations"]) == pytest.approx(dip, abs=0.01)
    assert m["meta"]["rays_fully_covered"] == 1.0


def test_wall_raises_horizon_only_toward_it(walled):
    lat, lon = -89.99, 0.0
    m = lt.horizon_mask(walled, lat, lon, observer_height_m=2.0, max_dist_m=30_000)
    el = np.array(m["elevations"])
    toward = az_of_plus_x(lat, lon)
    i = int(round(toward / m["az_step_deg"])) % len(el)
    # Site sits ~303 m from the pole; the wall edge is ~5 km away in +x: about atan(498/4700) ≈ 6°.
    assert 4.0 < el[i] < 7.5
    away = (i + len(el) // 2) % len(el)
    assert el[away] < 0.1
    assert el.argmax() in range(i - 40, i + 41) or abs(el.argmax() - i) > len(el) - 41


def test_site_outside_dem_raises(flat):
    with pytest.raises(ValueError):
        lt.horizon_mask(flat, -80.0, 0.0)


def test_truncated_rays_are_reported(flat):
    m = lt.horizon_mask(flat, -89.99, 0.0, max_dist_m=80_000)  # longer than the DEM
    assert m["meta"]["rays_fully_covered"] < 1.0
    assert m["meta"]["min_ray_coverage_km"] < 80


def test_grid_and_build_cli(tmp_path, walled):
    g = lt.grid_masks(walled, -89.99, 0.0, n=1, spacing_m=500, max_dist_m=20_000)
    assert len(g["points"]) == 9

    dem_path = write_dem(tmp_path / "cli.tif", lambda X, Y: 300 * np.sin(X / 3000) * np.cos(Y / 4000))
    sites = tmp_path / "sites.json"
    sites.write_text(json.dumps({"sites": [
        {"id": "polar_test", "region": "south_pole", "lat": -89.9, "lon": 45.0},
        {"id": "far_away", "region": "south_pole", "lat": -80.0, "lon": 0.0},
    ]}))
    out = tmp_path / "terrain"
    rc = build_site_assets.main(["--dem", str(dem_path), "--sites", str(sites), "--out", str(out),
                                 "--max-dist-km", "20", "--grid-n", "1", "--size", "64", "--extent-km", "10"])
    assert rc == 0
    d = out / "polar_test"
    mask = json.loads((d / "mask.json").read_text())
    assert len(mask["elevations"]) == 720
    assert (d / "grid.json").exists() and (d / "hillshade.png").exists()
    meta = json.loads((d / "heightmap.json").read_text())
    assert (d / "heightmap.bin").stat().st_size == 64 * 64 * 4 and meta["size"] == 64
    assert not (out / "far_away").exists()
