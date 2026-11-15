// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Terrain self-shadowing on a heightmap by ray-marching towards the Sun.
 *
 * Grid: n × n heights in metres, row 0 = north edge, column 0 = west edge, cell metres apart.
 * For each vertex, walk towards the Sun's azimuth one cell at a time and keep the highest
 * elevation angle of the terrain, with the Moon's curvature (a point d metres away sits
 * d²/2R below the local tangent plane). The visible fraction of the solar disc follows from
 * that skyline angle: 1 when the skyline is a disc radius below the Sun, 0 when a radius above.
 * Exact for the heightmap and free of shadow-map artefacts.
 */
const MOON_R = 1737400;

/** Bilinear height at fractional (row, col); null outside the grid. */
function sample(z, n, r, c) {
  if (r < 0 || c < 0 || r > n - 1 || c > n - 1) return null;
  const r0 = Math.min(n - 2, Math.floor(r));
  const c0 = Math.min(n - 2, Math.floor(c));
  const fr = r - r0;
  const fc = c - c0;
  const i = r0 * n + c0;
  return z[i] * (1 - fr) * (1 - fc) + z[i + 1] * (1 - fr) * fc + z[i + n] * fr * (1 - fc) + z[i + n + 1] * fr * fc;
}

/**
 * Visible fraction (0–1) of the Sun's disc at every vertex.
 * @param {Float32Array|number[]} z heights (m), length n*n
 * @param {number} n grid size
 * @param {number} cell metres between vertices
 * @param {number} azDeg Sun azimuth, clockwise from north
 * @param {number} elDeg Sun elevation above the local horizontal
 * @param {number} disc Sun's angular radius (deg)
 */
export function sunVisibility(z, n, cell, azDeg, elDeg, disc = 0.267) {
  const out = new Float32Array(n * n);
  if (elDeg < -10) return out; // far below the horizon everywhere in a 20 km tile
  const a = (azDeg * Math.PI) / 180;
  const dc = Math.sin(a); // east → +column
  const dr = -Math.cos(a); // north → −row
  let zmax = -Infinity;
  for (let i = 0; i < z.length; i++) if (z[i] > zmax) zmax = z[i];
  const top = elDeg + disc;
  const bottom = elDeg - disc;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const z0 = z[r * n + c];
      let best = -90;
      for (let k = 1; ; k++) {
        const d = k * cell;
        const h = sample(z, n, r + k * dr, c + k * dc);
        if (h === null) break;
        const ang = (Math.atan2(h - z0 - (d * d) / (2 * MOON_R), d) * 180) / Math.PI;
        if (ang > best) best = ang;
        if (best >= top) break; // whole disc hidden
        // Stop when even the highest point of the tile, this far away, could neither raise the
        // skyline nor reach the lower edge of the disc (curvature would only lower it further).
        const maxPossible = (Math.atan2(zmax - z0, d) * 180) / Math.PI;
        if (maxPossible <= Math.max(best, bottom)) break;
      }
      out[r * n + c] = Math.max(0, Math.min(1, (elDeg - best) / (2 * disc) + 0.5));
    }
  }
  return out;
}

/** Unit vector (east, north, up) of a body at azimuth/elevation. */
export function direction(azDeg, elDeg) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}
