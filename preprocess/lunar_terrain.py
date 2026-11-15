# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Lunar Nav terrain toolkit.

Computes, from a NASA LOLA digital elevation model (DEM):
  * the terrain horizon (skyline elevation angle vs azimuth) seen from a site,
  * horizon masks on a grid of points around the site (sensitivity map),
  * a hillshade image and a downsampled heightmap for the map and the 3D view.

Geometry: spherical Moon, R = 1737.4 km (the LOLA reference radius). DEM heights
are metres above that sphere. For a terrain point at great-circle angle d/R and
radius R+z, the elevation angle seen from radius R+z0+h is exact on the sphere:

    angle = atan2((R+z)·cos(d/R) − (R+z0+h), (R+z)·sin(d/R))

The horizon at an azimuth is the maximum angle along the ray. Rays leave the DEM
at its edge; the fraction of each ray that was covered is recorded so a truncated
horizon is never presented as complete.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import rasterio
from pyproj import CRS, Transformer

MOON_RADIUS_M = 1_737_400.0
MOON_GEOGRAPHIC = CRS.from_proj4(f"+proj=longlat +R={MOON_RADIUS_M} +no_defs +type=crs")


@dataclass
class Dem:
    """A DEM in memory with its geotransform and a lon/lat → raster transformer."""

    data: np.ndarray            # heights in metres above the reference sphere, NaN = no data
    transform: rasterio.Affine
    crs: CRS
    pixel_m: float
    product: str

    @classmethod
    def open(cls, path: str, units: str = "m", scale: Optional[float] = None, product: str = "") -> "Dem":
        with rasterio.open(path) as src:
            arr = src.read(1, masked=True).astype("float64")
            data = arr.filled(np.nan)
            s = scale if scale is not None else (src.scales[0] if src.scales else 1.0)
            o = src.offsets[0] if src.offsets else 0.0
            data = data * s + o
            if units == "km":
                data *= 1000.0
            crs = CRS.from_wkt(src.crs.to_wkt()) if src.crs else None
            if crs is None:
                raise ValueError("DEM has no coordinate reference system.")
            px = abs(src.transform.a)
            return cls(data=data, transform=src.transform, crs=crs, pixel_m=px, product=product or path.split("/")[-1])

    def _to_xy(self) -> Transformer:
        return Transformer.from_crs(MOON_GEOGRAPHIC, self.crs, always_xy=True)

    def sample(self, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        """Bilinear heights at lat/lon (degrees, east-positive). NaN outside the DEM."""
        x, y = self._to_xy().transform(np.asarray(lon) % 360.0, np.asarray(lat))
        inv = ~self.transform
        x = np.asarray(x)
        y = np.asarray(y)
        col = inv.a * x + inv.b * y + inv.c - 0.5
        row = inv.d * x + inv.e * y + inv.f - 0.5
        h, w = self.data.shape
        c0 = np.floor(col).astype(int)
        r0 = np.floor(row).astype(int)
        inside = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < w) & (r0 + 1 < h)
        out = np.full(col.shape, np.nan)
        if not inside.any():
            return out
        ci, ri = c0[inside], r0[inside]
        fc, fr = col[inside] - ci, row[inside] - ri
        d = self.data
        v = (d[ri, ci] * (1 - fc) * (1 - fr) + d[ri, ci + 1] * fc * (1 - fr)
             + d[ri + 1, ci] * (1 - fc) * fr + d[ri + 1, ci + 1] * fc * fr)
        out[inside] = v
        return out


def destination(lat: float | np.ndarray, lon: float | np.ndarray, az_deg, dist_m):
    """Great-circle destination on the lunar sphere. Broadcasts over az and distance."""
    d = np.asarray(dist_m) / MOON_RADIUS_M
    p1 = np.radians(lat)
    l1 = np.radians(lon)
    a = np.radians(az_deg)
    p2 = np.arcsin(np.sin(p1) * np.cos(d) + np.cos(p1) * np.sin(d) * np.cos(a))
    l2 = l1 + np.arctan2(np.sin(a) * np.sin(d) * np.cos(p1), np.cos(d) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), np.degrees(l2) % 360.0


def ray_distances(pixel_m: float, max_dist_m: float, samples: int = 700) -> np.ndarray:
    """Distances along a ray: about one pixel apart near the site, growing geometrically."""
    start = max(pixel_m, 1.0)
    return np.geomspace(start, max_dist_m, samples)


def horizon_mask(dem: Dem, lat: float, lon: float, observer_height_m: float = 2.0,
                 az_step_deg: float = 0.5, max_dist_m: float = 60_000.0, samples: int = 700) -> dict:
    """Terrain horizon from a site. Returns elevations per azimuth bin and coverage."""
    z0 = float(dem.sample(np.array([lat]), np.array([lon]))[0])
    if np.isnan(z0):
        raise ValueError(f"Site {lat:.4f}, {lon:.4f} is outside the DEM or on a no-data cell.")
    az = np.arange(0.0, 360.0, az_step_deg)
    dist = ray_distances(dem.pixel_m, max_dist_m, samples)
    AZ, D = np.meshgrid(az, dist, indexing="ij")
    plat, plon = destination(lat, lon, AZ, D)
    z = dem.sample(plat.ravel(), plon.ravel()).reshape(AZ.shape)
    r_obs = MOON_RADIUS_M + z0 + observer_height_m
    r_pt = MOON_RADIUS_M + z
    delta = D / MOON_RADIUS_M
    ang = np.degrees(np.arctan2(r_pt * np.cos(delta) - r_obs, r_pt * np.sin(delta)))
    valid = ~np.isnan(ang)
    # Smooth-sphere horizon (dip) for an observer at r_obs: used where the ray has no data.
    dip = -np.degrees(np.arccos(MOON_RADIUS_M / r_obs)) if r_obs > MOON_RADIUS_M else 0.0
    ang_filled = np.where(valid, ang, -90.0)
    elev = np.maximum(ang_filled.max(axis=1), dip)
    covered = np.where(valid.any(axis=1), (valid * D).max(axis=1), 0.0)
    return {
        "az_step_deg": az_step_deg,
        "elevations": [round(float(v), 4) for v in elev],
        "meta": {
            "product": dem.product,
            "pixel_m": round(dem.pixel_m, 3),
            "observer_height_m": observer_height_m,
            "site_elevation_m": round(z0, 2),
            "max_distance_km": max_dist_m / 1000.0,
            "min_ray_coverage_km": round(float(covered.min()) / 1000.0, 2),
            "rays_fully_covered": round(float(np.mean(covered >= 0.98 * max_dist_m)), 4),
            "smooth_sphere_dip_deg": round(float(dip), 4),
            "method": "max exact spherical elevation angle along great-circle rays, bilinear DEM sampling",
        },
    }


def grid_masks(dem: Dem, lat: float, lon: float, n: int = 3, spacing_m: float = 500.0, **kw) -> dict:
    """Horizon masks on a (2n+1)² grid of points around the site (east = +x, north = +y)."""
    kw.setdefault("az_step_deg", 2.0)
    kw.setdefault("samples", 400)
    pts = []
    for gy in range(-n, n + 1):
        for gx in range(-n, n + 1):
            plat, plon = destination(lat, lon, 90.0, gx * spacing_m)
            plat, plon = destination(float(plat), float(plon), 0.0, gy * spacing_m)
            try:
                m = horizon_mask(dem, float(plat), float(plon), **kw)
            except ValueError:
                continue
            pts.append({"dx_m": gx * spacing_m, "dy_m": gy * spacing_m, "lat": round(float(plat), 6),
                        "lon": round(float(plon), 6), "az_step_deg": m["az_step_deg"], "elevations": m["elevations"]})
    return {"spacing_m": spacing_m, "az_step_deg": kw["az_step_deg"], "points": pts,
            "meta": {"product": dem.product, "observer_height_m": kw.get("observer_height_m", 2.0)}}


def local_grid(dem: Dem, lat: float, lon: float, extent_m: float, size: int) -> tuple[np.ndarray, float]:
    """Heights on a size×size local east/north grid centred on the site."""
    half = extent_m / 2.0
    offs = np.linspace(-half, half, size)
    E, N = np.meshgrid(offs, offs[::-1])  # row 0 = north edge
    dist = np.hypot(E, N)
    az = np.degrees(np.arctan2(E, N)) % 360.0
    plat, plon = destination(lat, lon, az, dist)
    z = dem.sample(plat.ravel(), plon.ravel()).reshape(E.shape)
    return z, extent_m / (size - 1)


def hillshade(z: np.ndarray, cell_m: float, azimuth_deg: float = 315.0, altitude_deg: float = 30.0) -> np.ndarray:
    """Classic hillshade (0–255). NaN becomes 0."""
    zz = np.nan_to_num(z, nan=np.nanmean(z) if np.isfinite(z).any() else 0.0)
    dy, dx = np.gradient(zz, cell_m)
    slope = np.arctan(np.hypot(dx, dy))
    aspect = np.arctan2(-dx, dy)
    az = np.radians(azimuth_deg)
    alt = np.radians(altitude_deg)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    out = np.clip(shade, 0, 1) * 255
    out[~np.isfinite(z)] = 0
    return out.astype(np.uint8)
