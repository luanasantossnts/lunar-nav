// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sunVisibility } from './shadow.js';

describe('terrain self-shadowing', () => {
  it('a wall shadows the ground behind it, not the ground in front', () => {
    const n = 21;
    const z = new Float32Array(n * n);
    for (let r = 0; r < n; r++) z[r * n + 10] = 200; // north–south wall in column 10
    // Sun low in the east (az 90°, el 1°): west of the wall is in shadow, east is lit.
    const v = sunVisibility(z, n, 100, 90, 1);
    expect(v[10 * n + 5]).toBe(0);
    expect(v[10 * n + 15]).toBe(1);
    // Sun high: nothing is shadowed by a 200 m wall 500 m away at 60°.
    expect(sunVisibility(z, n, 100, 90, 60)[10 * n + 5]).toBe(1);
  });

  it('gives a partial disc in the penumbra', () => {
    const n = 11;
    const z = new Float32Array(n * n);
    for (let r = 0; r < n; r++) z[r * n + 6] = 100 * Math.tan((1 * Math.PI) / 180); // skyline exactly at 1°
    const v = sunVisibility(z, n, 100, 90, 1)[5 * n + 5];
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThan(0.7);
  });

  it('Shackleton: the crater floor is in shadow with the Sun at ~1° behind the rim; the rim site is lit', () => {
    const dir = new URL('../../../api/data/terrain/shackleton_ridge/', import.meta.url);
    const meta = JSON.parse(readFileSync(new URL('heightmap.json', dir), 'utf8'));
    const buf = readFileSync(new URL('heightmap.bin', dir));
    const z = new Float32Array(buf.buffer, buf.byteOffset, meta.size * meta.size);
    const n = meta.size;
    let iMin = 0;
    for (let i = 1; i < z.length; i++) if (z[i] < z[iMin]) iMin = i;
    const rMin = Math.floor(iMin / n);
    const cMin = iMin % n;
    // Azimuth from the crater floor towards the site (tile centre): the rim lies in between.
    const east = (n / 2 - cMin) * meta.cell_m;
    const north = (rMin - n / 2) * meta.cell_m;
    const azRim = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
    const v = sunVisibility(z, n, meta.cell_m, azRim, 1);
    expect(v[iMin]).toBe(0);
    // The site sits on the ridge: with the Sun at 1° towards az 7.5° (its lowest skyline) it is lit.
    const centre = (n / 2) * n + n / 2;
    expect(sunVisibility(z, n, meta.cell_m, 7.5, 1)[centre]).toBeGreaterThan(0.9);
  });
});
