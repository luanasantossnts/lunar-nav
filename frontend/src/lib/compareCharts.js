// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Data for the two charts above the Compare table. Built only from data the page already has:
 * the /delay results for A and B (original and delayed scenario) and, for the ±300 m box of
 * the original scenario, the results the app loaded for the same site, dates, mode and margin.
 * The delay endpoint has no ±300 m spread, so the delayed bars carry none (no new request).
 */

export const METRICS = ['sun', 'earth', 'comm'];

const range = (lo, hi) => (lo === undefined || lo === null || hi === undefined || hi === null ? null : [Math.min(lo, hi), Math.max(lo, hi)]);

/** The ±300 m spread of `result`, only if it is the same scenario as `scenario` (site, period, horizon). */
export function matchingSpread(result, scenario) {
  if (!result?.position_spread?.available || !scenario) return null;
  const same = result.site?.id === scenario.site?.id
    && result.metrics?.period?.start === scenario.metrics?.period?.start
    && result.metrics?.period?.end === scenario.metrics?.period?.end
    && result.provenance?.horizon?.mode === scenario.provenance?.horizon?.mode;
  return same ? result.position_spread : null;
}

function bar(who, when, scenario, spread, key) {
  const b = scenario?.metrics?.[key];
  if (!b) return null;
  return {
    who, when, key,
    value: b.fraction,
    disc: range(b.disc_range?.full_disc?.fraction, b.disc_range?.first_limb?.fraction),
    pos: spread && spread[key] ? range(spread[key].p10, spread[key].p90) : null,
  };
}

/**
 * 1 · "Original vs +N days": per metric, the bars A original, A delayed, B original, B delayed
 * (sides without data are left out). Fractions 0–1.
 */
export function groupedBars(delayA, delayB, resultA, resultB) {
  const sides = [['A', delayA, resultA], ['B', delayB, resultB]].filter(([, d]) => d?.scenarios?.length === 2);
  return METRICS.map((key) => ({
    key,
    bars: sides.flatMap(([who, d, res]) => [
      bar(who, 'original', d.scenarios[0], matchingSpread(res, d.scenarios[0]), key),
      bar(who, 'delayed', d.scenarios[1], null, key),
    ]).filter(Boolean),
  })).filter((g) => g.bars.length > 0);
}

/**
 * How to qualify a difference "delayed − original" when one side is only a minimum (its night
 * runs past the analysed window): if only the delayed value is a minimum, the true change is at
 * least the shown one (≥); if only the original is, at most (≤); if both are, it is approximate (≈).
 */
export function deltaQualifier(originalIsMin, delayedIsMin) {
  if (originalIsMin && delayedIsMin) return '≈';
  if (delayedIsMin) return '≥';
  if (originalIsMin) return '≤';
  return '';
}

/**
 * 2 · "What the delay changes": signed changes (delayed − original) for A and B — hours of Sun,
 * Earth in view and contact (common scale), and the battery in kWh (its own scale).
 */
export function deltaRows(delayA, delayB) {
  return [['A', delayA], ['B', delayB]].filter(([, d]) => d?.delta && d?.scenarios?.length === 2).map(([who, d]) => {
    const [o, x] = d.scenarios;
    const oMin = !!o.metrics?.power?.lower_bound;
    const xMin = !!x.metrics?.power?.lower_bound;
    return {
      who,
      site: o.site,
      delayDays: d.delay_days,
      hours: { sun: d.delta.sun_hours ?? null, earth: d.delta.earth_hours ?? null, comm: d.delta.comm_hours ?? null },
      battery: d.delta.battery_kwh === undefined ? null : { value: d.delta.battery_kwh, qualifier: deltaQualifier(oMin, xMin) },
    };
  });
}

/** Symmetric axis limit for diverging bars (never 0), with 10 % headroom. */
export function divergingMax(values) {
  const m = Math.max(0, ...values.filter((v) => v !== null && v !== undefined).map((v) => Math.abs(v)));
  return m > 0 ? m * 1.1 : 1;
}
