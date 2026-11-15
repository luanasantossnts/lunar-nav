// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Data for the Charts tab, built only from existing API results (metrics with the ±300 m
 * spread, delay, the cached 2030 year, the PGDA validation and the sensitivity grid).
 * Pure functions: no fetching, no formatting; the page formats with lib/format.js.
 */

/** Sites shown in the Charts tab: those with a terrain horizon, plus Chandrayaan-3 (geometric). */
export const CHART_SITES = [
  ['shackleton_ridge', 'terrain'],
  ['im2_athena', 'terrain'],
  ['malapert_m1', 'terrain'],
  ['im1_odysseus', 'terrain'],
  ['chandrayaan3', 'geometric'],
];

/** Short axis labels (the full name is in the data table and the tooltip). */
export const SHORT = { shackleton_ridge: 'Shackleton', im2_athena: 'IM-2', malapert_m1: 'Malapert', im1_odysseus: 'IM-1', chandrayaan3: 'Chandrayaan-3' };

const span = (lo, hi) => (lo === undefined || lo === null || hi === undefined || hi === null ? null : [Math.min(lo, hi), Math.max(lo, hi)]);

/** 1 · Sun, Earth in view and DSN contact per site, with disc range and ±300 m P10–P90. */
export function siteBars(results) {
  return results.filter(Boolean).map((r) => {
    const m = r.metrics;
    const ps = r.position_spread?.available ? r.position_spread : null;
    const bar = (key, block) => (block ? {
      key,
      value: block.fraction,
      disc: span(block.disc_range?.full_disc?.fraction, block.disc_range?.first_limb?.fraction),
      pos: ps && ps[key] ? span(ps[key].p10, ps[key].p90) : null,
    } : null);
    return {
      id: r.site.id,
      name: r.site.name,
      mode: r.provenance?.horizon?.mode ?? 'geometric',
      bars: [bar('sun', m.sun), bar('earth', m.earth), bar('comm', m.comm)].filter(Boolean),
    };
  });
}

/** 2 · Month-by-month Sun and Earth visibility (from /charts/year). */
export function monthlyLines(year) {
  if (!year?.sites) return [];
  return year.sites.filter((s) => s.available).map((s) => ({
    id: s.site,
    name: s.name,
    mode: s.horizon?.mode ?? s.mode,
    sun: s.months.map((m) => m.sun_fraction),
    earth: s.months.map((m) => m.earth_fraction),
  }));
}

/** Weighted (by days) yearly mean of 12 monthly fractions. */
export function yearMean(monthly, year = 2030) {
  let a = 0; let d = 0;
  monthly.forEach((f, i) => {
    const days = new Date(Date.UTC(year, i + 1, 0)).getUTCDate();
    if (f !== null && f !== undefined) { a += f * days; d += days; }
  });
  return d ? a / d : null;
}

/** 3 · Our year (first limb) vs NASA PGDA, with Δ in points and the ranking check. */
export function pgdaRows(validation) {
  const c = validation?.checks?.find((x) => x.id === 'pgda_reference');
  const d = c?.detail;
  if (!d?.rows) return null;
  return {
    year: d.year,
    status: c.status,
    sameRanking: !!d.ranking?.same,
    ranking: d.ranking?.ours ?? [],
    rows: d.rows.map((r) => ({
      id: r.site,
      mode: r.mode,
      sunOurs: r.ours.sun_first_limb,
      sunPgda: r.pgda.sun,
      sunDelta: r.delta_points.sun,
      earthOurs: r.ours.earth_first_limb,
      earthPgda: r.pgda.earth,
      earthDelta: r.delta_points.earth,
    })),
  };
}

/** 4 · Battery needed per site, with its ±300 m P10–P90 and lower-bound flags. */
export function batteryRows(results) {
  return results.filter((r) => r?.metrics?.power).map((r) => {
    const p = r.metrics.power;
    const s = r.position_spread?.available ? r.position_spread.battery_kwh : null;
    return {
      id: r.site.id,
      name: r.site.name,
      kwh: p.battery_kwh,
      lowerBound: !!p.lower_bound,
      nightH: p.longest_night_h,
      pos: s ? span(s.p10, s.p90) : null,
      posLowerBound: s ? [!!s.lower_bound?.p10, !!s.lower_bound?.p90] : null,
    };
  });
}

/**
 * "Where you land matters more than when": compares, per site with a ±300 m range, the width
 * of that range with the change a delay makes. Holds only if the range is wider at every such site.
 */
export function whereVsWhen(battery, delays) {
  const rows = battery.filter((b) => b.pos).map((b) => {
    const d = delays.find((x) => x?.scenarios?.[0]?.site?.id === b.id);
    const dd = d?.delta?.battery_kwh;
    return { id: b.id, width: b.pos[1] - b.pos[0], delayChange: dd === undefined || dd === null ? null : Math.abs(dd) };
  }).filter((r) => r.delayChange !== null);
  if (!rows.length) return null;
  return {
    holds: rows.every((r) => r.width > r.delayChange),
    holdsAt: rows.filter((r) => r.width > r.delayChange).map((r) => r.id),
    exceptions: rows.filter((r) => r.width <= r.delayChange),
    maxWidth: Math.max(...rows.map((r) => r.width)),
    maxDelayChange: Math.max(...rows.map((r) => r.delayChange)),
    rows,
  };
}

/**
 * Hours of daylight from the landing time to the first sunset. 0 when the Sun is not up at
 * landing; a lower bound when the Sun stays up past the end of the period.
 */
export function daylightBeforeNight(m) {
  const start = m.period.start;
  const end = m.period.end;
  const first = (m.sun.spans || []).find(([a, b]) => a <= start + 60 && b > start);
  if (!first) return { hours: 0, lowerBound: false, darkAtLanding: true };
  const lb = first[1] >= end - 60;
  return { hours: (Math.min(first[1], end) - start) / 3600, lowerBound: lb, darkAtLanding: false };
}

/** 5 · What a delay changes: daylight before the first night and contact, original vs delayed. */
export function delayRows(delays) {
  return delays.filter((d) => d?.scenarios?.length === 2).map((d) => {
    const [o, x] = d.scenarios;
    return {
      id: o.site.id,
      name: o.site.name,
      delayDays: d.delay_days,
      daylight: [daylightBeforeNight(o.metrics), daylightBeforeNight(x.metrics)],
      comm: [o.metrics.comm?.fraction ?? null, x.metrics.comm?.fraction ?? null],
    };
  });
}

/** 6 · Histogram of Sun fractions of the grid points within the spread radius of site A. */
export function sunHistogram(sensitivity, bins = 10) {
  if (!sensitivity?.available || !sensitivity.points?.length) return null;
  const radius = sensitivity.summary?.radius_m ?? 300;
  const near = sensitivity.points.filter((p) => Math.hypot(p.dx_m, p.dy_m) <= radius + 1e-6);
  const counts = new Array(bins).fill(0);
  near.forEach((p) => { counts[Math.min(bins - 1, Math.floor(p.sun_fraction * bins))] += 1; });
  const site = sensitivity.points.find((p) => p.dx_m === 0 && p.dy_m === 0);
  return {
    radius,
    n: near.length,
    counts,
    edges: Array.from({ length: bins + 1 }, (_, i) => i / bins),
    sitePoint: site ? site.sun_fraction : null,
    p10: sensitivity.summary?.sun?.p10 ?? null,
    median: sensitivity.summary?.sun?.median ?? null,
    p90: sensitivity.summary?.sun?.p90 ?? null,
  };
}

/** Spreads labels vertically so none are closer than `gap` px (for end-of-line labels). */
export function spreadLabels(items, gap = 13, min = 0, max = Infinity) {
  const s = [...items].sort((a, b) => a.y - b.y).map((x) => ({ ...x }));
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  const over = s.length ? s[s.length - 1].y - max : 0;
  if (over > 0) s.forEach((x) => { x.y -= over; });
  for (let i = s.length - 2; i >= 0; i--) if (s[i + 1].y - s[i].y < gap) s[i].y = s[i + 1].y - gap;
  if (s.length && s[0].y < min) { const d = min - s[0].y; s.forEach((x) => { x.y += d; }); }
  return s;
}
