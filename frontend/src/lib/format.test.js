// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { discSpan, num, numSpan, pctSpan, spreadSpan } from './format.js';

describe('number + unit never wraps', () => {
  it('every formatter joins number and unit with a no-break space', async () => {
    const f = await import('./format.js');
    const outs = [f.pct(0.508), f.pctSpan(0.1, 0.2), f.num(6712, 0, 'Wh/d'), f.num(1.5, 1, 'kg'), f.numSpan(1, 2, 0, 'kWh'),
      f.numSpanBound(1, true, 2, false, 1, 'h'), f.hrs(344.6), f.signed(-1.01, 2, 'kWh'), f.signed(3), f.ge('349.9\u00A0h', true)];
    outs.forEach((o) => expect(o, o).not.toMatch(/\d[ \u2009](%|h|kWh|Wh|kg|km|m)\b|\d[ \u2009]%/));
    expect(f.num(12345)).not.toMatch(/ |\u2009/); // thousands separator is narrow no-break
  });
});

describe('power numbers', () => {
  it('formats thousands with a narrow no-break space, signs and units', () => {
    expect(num(6712.4, 0, 'Wh/d')).toBe('6\u202F712\u00A0Wh/d');
    expect(num(-1234.5, 0)).toBe('−1\u202F235');
    expect(num(1.234, 2, 'kWh')).toBe('1.23\u00A0kWh');
    expect(num(undefined)).toBe('—');
  });
  it('orders a numeric range low to high', () => {
    expect(numSpan(19.4, 3.2, 2, 'kWh')).toBe('3.20–19.40\u00A0kWh');
  });
});

describe('uncertainty ranges', () => {
  it('orders a range low to high', () => {
    expect(pctSpan(1, 0.943)).toBe('94.3–100.0\u00A0%');
    expect(pctSpan(0.481, 0.733)).toBe('48.1–73.3\u00A0%');
  });

  it('shows the disc range from full disc to first limb', () => {
    const dr = { first_limb: { fraction: 1 }, centre: { fraction: 0.9976 }, full_disc: { fraction: 0.9431 } };
    expect(discSpan(dr)).toBe('94.3–100.0\u00A0%');
    expect(discSpan(undefined)).toBe('—');
  });

  it('shows P10–P90 only when the spread is available', () => {
    const ps = { available: true, radius_m: 300, sun: { p10: 0.481, median: 0.566, p90: 0.733 } };
    expect(spreadSpan(ps, 'sun')).toBe('48.1–73.3\u00A0%');
    expect(spreadSpan({ available: false, reason: 'no grid' }, 'sun')).toBe('—');
    expect(spreadSpan(null, 'sun')).toBe('—');
  });
});
