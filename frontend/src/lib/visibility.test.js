// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { bodyStatus, horizonAt, inSpans, positionAt } from './visibility.js';
import { coord, pct, signed } from './format.js';

describe('visibility helpers', () => {
  it('finds times inside spans', () => {
    const spans = [[0, 10], [20, 30], [40, 50]];
    expect(inSpans(spans, 5)).toBe(true);
    expect(inSpans(spans, 15)).toBe(false);
    expect(inSpans(spans, 50)).toBe(true);
    expect(inSpans([], 1)).toBe(false);
  });

  it('interpolates position across the 360° wrap', () => {
    const rows = [[0, 350, 1], [100, 10, 3]];
    const p = positionAt(rows, 50);
    expect(p.az).toBeCloseTo(0, 6);
    expect(p.el).toBeCloseTo(2, 6);
  });

  it('reads a mask with wrap-around', () => {
    const mask = { az_step_deg: 90, elevations: [0, 10, 0, -10] };
    expect(horizonAt(mask, 45)).toBeCloseTo(5);
    expect(horizonAt(mask, 315)).toBeCloseTo(-5);
    expect(horizonAt(null, 123)).toBe(0);
  });

  it('classifies terrain blocking separately from the smooth horizon', () => {
    const rows = [[0, 90, 4], [100, 90, 4]];
    const mask = { az_step_deg: 90, elevations: [0, 6, 0, 0] };
    expect(bodyStatus(rows, mask, 50).status).toBe('terrain');
    expect(bodyStatus(rows, null, 50).status).toBe('visible');
    expect(bodyStatus([[0, 90, -1], [100, 90, -1]], null, 50).status).toBe('below');
  });

  it('separates the four cases: visible, within the antenna margin, behind terrain, below the horizon', () => {
    const at = (el) => [[0, 90, el], [100, 90, el]];
    const flat = null;
    const wall = { az_step_deg: 90, elevations: [0, 3, 0, 0] }; // skyline 3° towards the east
    // Geometric: Earth at 0.55° with a 1° antenna margin is above the horizon, not below it.
    expect(bodyStatus(at(0.55), flat, 50, 1).status).toBe('margin');
    expect(bodyStatus(at(0.55), flat, 50, 1).margin).toBe(1);
    expect(bodyStatus(at(1.5), flat, 50, 1).status).toBe('visible');
    expect(bodyStatus(at(-0.5), flat, 50, 1).status).toBe('below');
    // Terrain: above the 3° skyline but within the margin; behind the skyline; below 0°.
    expect(bodyStatus(at(3.4), wall, 50, 1).status).toBe('margin');
    expect(bodyStatus(at(2), wall, 50, 1).status).toBe('terrain');
    expect(bodyStatus(at(-1), wall, 50, 1).status).toBe('below');
    expect(bodyStatus(at(4.5), wall, 50, 1).status).toBe('visible');
  });
});

describe('format', () => {
  it('formats numbers for display', () => {
    expect(pct(0.446)).toBe('44.6\u00A0%');
    expect(coord(-89.684, 196.739)).toBe('89.68°S 196.74°E');
    expect(signed(-3.25)).toBe('−3.3\u00A0h');
    expect(signed(0)).toBe('±0.0\u00A0h');
  });
});
