// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALBEDO, maskElevation, openingView, regolith, ringProfile, skyPosition } from './sky3d.js';
import { direction, sunVisibility } from './shadow.js';

describe('lunar shading', () => {
  const up = [0, 0, 1];
  it('shadow is almost black (no air, minimal ambient)', () => {
    const c = regolith(...up, direction(90, 1), direction(0, 30), 0, false);
    expect(Math.max(...c)).toBeLessThan(0.01);
  });
  it('hard sunlight: a slope facing a 1° Sun is bright, flat ground is dim, the back slope is dark', () => {
    const S = direction(90, 1);
    const facing = regolith(Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4), S, S, 1, false); // normal tilted towards the east
    const flat = regolith(...up, S, S, 1, false);
    const back = regolith(-Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4), S, S, 1, false);
    expect(facing[0]).toBeGreaterThan(0.3);
    expect(flat[0]).toBeGreaterThan(back[0]);
    expect(flat[0]).toBeLessThan(facing[0] / 3);
    expect(back[0]).toBeLessThan(0.01);
  });
  it('regolith is light grey and slightly warm (R ≥ G ≥ B)', () => {
    const c = regolith(...up, direction(0, 60), direction(0, 60), 1, false);
    expect(c[0]).toBeGreaterThanOrEqual(c[1]);
    expect(c[1]).toBeGreaterThanOrEqual(c[2]);
    expect(ALBEDO[0]).toBeGreaterThan(ALBEDO[2]);
  });
  it('earthlight is faint and blue, only when Earth is above the skyline', () => {
    const E = direction(0, 20);
    const on = regolith(...up, direction(180, -5), E, 0, true);
    const off = regolith(...up, direction(180, -5), E, 0, false);
    expect(on[2]).toBeGreaterThan(on[0]);
    expect(on[2]).toBeLessThan(0.2);
    expect(on[2]).toBeGreaterThan(off[2]);
  });
});

describe('sky placement', () => {
  it('places the Sun at its real azimuth and elevation (east = +X, north = −Z, up = +Y)', () => {
    const [x, y, z] = skyPosition([0, 100, 0], 90, 0, 1000);
    expect(x).toBeCloseTo(1000, 6); expect(y).toBeCloseTo(100, 6); expect(z).toBeCloseTo(0, 6);
    const north = skyPosition([0, 0, 0], 0, 30, 1000);
    expect(north[2]).toBeCloseTo(-866.03, 1); expect(north[1]).toBeCloseTo(500, 6);
  });
  it('reads the horizon mask with wrap-around, and the ring follows it', () => {
    const mask = { az_step_deg: 90, elevations: [0, 2, 0, -2] };
    expect(maskElevation(mask, 45)).toBeCloseTo(1, 6);
    expect(maskElevation(mask, 315)).toBeCloseTo(-1, 6);
    const { top, bottom } = ringProfile(mask, [0, 0, 0], 1000, 4);
    expect(top.length).toBe(15); // 5 points (0…360°) × xyz
    expect(top[4]).toBeCloseTo(1000 * Math.tan((2 * Math.PI) / 180), 3); // east point at +2°
    expect(bottom[1]).toBeLessThan(0);
  });
  it('opening view: behind the site, towards the Sun, turned less on narrow screens so the Sun stays in frame', () => {
    const wide = openingView(100, 20000, { aspect: 2.13 });
    const narrow = openingView(100, 20000, { aspect: 0.69 });
    expect(wide).toMatchObject({ el: 16, d: 3200 });
    expect((wide.az - 280 + 360) % 360).toBeCloseTo(30, 6);
    const off = (narrow.az - 280 + 360) % 360;
    expect(off).toBeGreaterThanOrEqual(0); expect(off).toBeLessThan(10);
  });
});

describe('heightmaps 512 × 512 and the shadow ray-march', () => {
  it('every site has a 512 × 512 heightmap over 20 km (1 MB)', () => {
    for (const s of ['shackleton_ridge', 'im2_athena', 'malapert_m1', 'im1_odysseus']) {
      const meta = JSON.parse(readFileSync(new URL(`../../../api/data/terrain/${s}/heightmap.json`, import.meta.url), 'utf8'));
      const bin = readFileSync(new URL(`../../../api/data/terrain/${s}/heightmap.bin`, import.meta.url));
      expect(meta.size, s).toBe(512);
      expect(meta.extent_m, s).toBe(20000);
      expect(bin.length, s).toBe(512 * 512 * 4);
      expect(meta.cell_m, s).toBeCloseTo(20000 / 511, 6);
    }
  });
  it('the ray-march runs in a Web Worker in the 3D view', () => {
    const src = readFileSync(new URL('../components/Terrain3D.jsx', import.meta.url), 'utf8');
    expect(src).toContain("new Worker(new URL('../lib/shadow.worker.js', import.meta.url)");
    expect(src).toContain("prefers-reduced-motion: reduce");
    expect(readFileSync(new URL('./shadow.worker.js', import.meta.url), 'utf8')).toContain('sunVisibility(');
  });
  it('a ridge casts a shadow towards the far side at a low Sun', () => {
    const n = 64; const z = new Float32Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) z[r * n + c] = c === 32 ? 200 : 0; // north–south ridge
    const vis = sunVisibility(z, n, 40, 90, 1); // Sun in the east, 1° high
    expect(vis[10 * n + 40]).toBe(1); // east of the ridge: lit
    expect(vis[10 * n + 20]).toBe(0); // west of the ridge: in its shadow
  });
});

describe('side-light framing', async () => {
  const { darkFraction, litFractionInView, loadViewMode, saveViewMode, sideView } = await import('./sky3d.js');
  // A tile with one slope facing east (lit by an eastern Sun) on the east half, flat elsewhere.
  const n = 64; const ext = 20000; const cell = ext / (n - 1);
  const z = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) z[r * n + c] = c > 32 ? -(c - 32) * cell * 0.3 : 0; // descends to the east
  const normals = new Float32Array(n * n * 3);
  for (let i = 0; i < n * n; i++) { const c = i % n; const s = c > 32 ? 0.3 : 0; const l = Math.hypot(s, 1); normals[i * 3] = s / l; normals[i * 3 + 1] = 0; normals[i * 3 + 2] = 1 / l; }
  const hm = { z, n, ext, min: Math.min(...z), exag: 1 };
  const S = direction(90, 1);
  const vis = new Float32Array(n * n).fill(1);
  const target = [0, -hm.min, 0];
  it('counts lit, camera-facing vertices in the frame', () => {
    const f = litFractionInView(hm, normals, vis, S, [0, 3000, 5000], target, 45, 2);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThanOrEqual(1);
    expect(litFractionInView(hm, normals, new Float32Array(n * n), S, [0, 3000, 5000], target, 45, 2)).toBe(0);
  });
  it('puts the camera at the Sun azimuth ± 90°, ~30° up, on the side that shows more sunlight', () => {
    const v = sideView(hm, normals, vis, S, 90, target, { aspect: 2 });
    expect([0, 180]).toContain(Math.round(v.az));
    expect(v.el).toBe(30);
    expect(v.d).toBeCloseTo(3200, 6);
  });
  it('measures the share of near-black pixels', () => {
    const px = new Uint8Array(4 * 100);
    for (let i = 0; i < 70; i++) px.set([0, 0, 0, 255], i * 4);
    for (let i = 70; i < 100; i++) px.set([180, 175, 160, 255], i * 4);
    expect(darkFraction(px, 1)).toBeCloseTo(0.7, 6);
  });
  it('remembers the framing for the session; side light by default', () => {
    const m = new Map(); const st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    expect(loadViewMode(st)).toBe('side');
    saveViewMode('sun', st);
    expect(loadViewMode(st)).toBe('sun');
    expect(loadViewMode({ getItem: () => { throw new Error('blocked'); } })).toBe('side');
  });
  it('low-Sun notice and the two buttons exist in three languages', async () => {
    const { makeT } = await import('./i18n.js');
    expect(makeT('en')('sky.lowSun')).toBe('Low Sun: most slopes are in shadow — this is how the lunar south pole looks.');
    for (const l of ['pt', 'es']) for (const k of ['sky.viewSide', 'sky.viewSun', 'sky.lowSun', 'sky.viewGroup']) expect(makeT(l)(k), `${l} ${k}`).not.toBe(k);
  });
});
