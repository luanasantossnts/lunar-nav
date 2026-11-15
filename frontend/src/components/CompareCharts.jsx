// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { NBSP, pct, pctSpan, signed } from '../lib/format.js';
import { deltaRows, divergingMax, groupedBars } from '../lib/compareCharts.js';
import { ChartFrame, EARTH, Grid, MONO, SUN, Swatch, darker, pctTick } from './ChartKit.jsx';

const COLOR = { sun: SUN, earth: EARTH, comm: EARTH };
const metricLabel = (t, k) => ({ sun: t('common.sunlight'), earth: t('common.earthInView'), comm: t('common.comm') }[k]);
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const metricShort = (t, k) => cap({ sun: t('common.sun'), earth: t('common.earth'), comm: t('common.commShort') }[k]);

/* ---------- 1 · Original vs +N days ---------- */
function OriginalVsDelayed({ groups, delayDays, names }) {
  const { t, siteName, siteShort } = useApp();
  const when = (b) => (b.when === 'original' ? t('compare.original') : t('compare.delayed', { n: delayDays }));
  const summary = t('compare.charts.c1.summary', {
    n: delayDays,
    list: groups.map((g) => `${metricLabel(t, g.key)}: ${g.bars.map((b) => `${b.who} ${when(b)} ${pct(b.value)}`).join(', ')}`).join('; '),
  });
  return (
    <ChartFrame id="cmp-chart-orig" title={t('compare.charts.c1.title', { n: delayDays })} what={t('compare.charts.c1.what', { n: delayDays })}
      legend={[
        [<Swatch key="o" color="var(--text2)" />, t('compare.original')],
        [<Swatch key="d" color="var(--text2)" kind="dark" />, t('compare.delayed', { n: delayDays })],
        [<Swatch key="w" kind="whisker" />, t('charts.discRange')],
        [<Swatch key="b" kind="box" />, t('compare.charts.posOriginal')],
      ]}
      table={{
        head: [t('compare.metric'), t('charts.site'), t('charts.value'), t('charts.discRange'), t('charts.posRange')],
        rows: groups.flatMap((g) => g.bars.map((b) => [`${metricLabel(t, g.key)} · ${when(b)}`, `${b.who} · ${names[b.who]}`, pct(b.value), b.disc ? pctSpan(b.disc[0], b.disc[1]) : '—', b.pos ? pctSpan(b.pos[0], b.pos[1]) : '—'])),
      }}>
      {(w) => {
        const H = 270; const m = { l: 44, r: 6, t: 10, b: 50 };
        const ih = H - m.t - m.b; const gw = (w - m.l - m.r) / groups.length;
        const per = Math.max(...groups.map((g) => g.bars.length));
        const bw = Math.max(7, Math.min(24, (gw - 28) / per - 2));
        const y = (f) => m.t + (1 - f) * ih;
        return (
          <svg width={w} height={H} role="img" aria-label={summary} className="block">
            <Grid x0={m.l} x1={w - m.r} y={(v) => y(v / 100)} ticks={[0, 25, 50, 75, 100]} fmt={pctTick} />
            {groups.map((g, gi) => {
              const pairGap = 8;
              const groupW = g.bars.length * (bw + 2) + pairGap;
              const gx = m.l + gi * gw + (gw - groupW) / 2;
              return (
                <g key={g.key}>
                  {g.bars.map((b, k) => {
                    const x = gx + k * (bw + 2) + (b.who === 'B' ? pairGap : 0);
                    const cx = x + bw / 2;
                    const fill = b.when === 'delayed' ? darker(COLOR[g.key]) : COLOR[g.key];
                    return (
                      <g key={`${b.who}${b.when}`}>
                        <title>{`${b.who} · ${names[b.who]} · ${metricLabel(t, g.key)} · ${when(b)}: ${pct(b.value)}`}</title>
                        <rect x={x} y={y(b.value)} width={bw} height={Math.max(0.5, y(0) - y(b.value))} style={{ fill, stroke: fill }}
                          fillOpacity={g.key === 'comm' ? 0.55 : 1} strokeWidth={g.key === 'comm' ? 1.5 : 0} />
                        {b.pos && <rect x={x - 2} y={y(b.pos[1])} width={bw + 4} height={Math.max(1, y(b.pos[0]) - y(b.pos[1]))} fill="none" style={{ stroke: 'var(--ink)' }} strokeDasharray="3 2" strokeWidth="1.2" />}
                        {b.disc && (
                          <g style={{ stroke: 'var(--ink)' }} strokeWidth="1.5">
                            <line x1={cx} x2={cx} y1={y(b.disc[1])} y2={y(b.disc[0])} />
                            <line x1={cx - bw * 0.3} x2={cx + bw * 0.3} y1={y(b.disc[1])} y2={y(b.disc[1])} />
                            <line x1={cx - bw * 0.3} x2={cx + bw * 0.3} y1={y(b.disc[0])} y2={y(b.disc[0])} />
                          </g>
                        )}
                      </g>
                    );
                  })}
                  {['A', 'B'].filter((who) => g.bars.some((b) => b.who === who)).map((who) => {
                    const idx = g.bars.findIndex((b) => b.who === who);
                    const x = gx + idx * (bw + 2) + (who === 'B' ? pairGap : 0) + (2 * bw + 2) / 2;
                    return <text key={who} x={x} y={H - m.b + 14} textAnchor="middle" fontSize="11" fontFamily={MONO} style={{ fill: who === 'A' ? 'var(--sun)' : 'var(--earth)' }}>{who}</text>;
                  })}
                  <text x={m.l + gi * gw + gw / 2} y={H - m.b + 32} textAnchor="middle" fontSize="12" style={{ fill: 'var(--text2)' }}>{gw < 170 ? metricShort(t, g.key) : metricLabel(t, g.key)}</text>
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/* ---------- 2 · What the delay changes ---------- */
function DelayChanges({ rows, delayDays }) {
  const { t, siteName, siteShort } = useApp();
  const hoursMax = divergingMax(rows.flatMap((r) => Object.values(r.hours)));
  const kwhMax = divergingMax(rows.map((r) => r.battery?.value));
  const batt = (r) => (r.battery ? `${r.battery.qualifier ? `${r.battery.qualifier}${NBSP}` : ''}${signed(r.battery.value, 2, 'kWh')}` : '—');
  const summary = t('compare.charts.c2.summary', {
    n: delayDays,
    list: rows.map((r) => `${r.who} ${siteShort(r.site)}: ${t('common.sun')} ${signed(r.hours.sun)}, ${t('common.earth')} ${signed(r.hours.earth)}, ${t('common.commShort')} ${signed(r.hours.comm)}, ${t('power.batteryShort')} ${batt(r)}`).join('; '),
  });

  /** One diverging panel: rows of [label, value, colour, text, light]. */
  const panel = (w, title, items, max) => {
    const rowH = 26; const m = { l: w < 480 ? 92 : 128, r: 8, t: 22, b: 18 };
    const H = m.t + items.length * rowH + m.b;
    const iw = w - m.l - m.r; const pad = 68; // room for the value labels on both sides
    const cx = m.l + iw / 2; const half = iw / 2 - pad;
    const x = (v) => cx + (v / max) * half;
    return (
      <svg width={w} height={H} className="block" aria-hidden="true">
        <text x={0} y={13} fontSize="12" fontWeight="600" style={{ fill: 'var(--text2)' }}>{title}</text>
        <line x1={cx} x2={cx} y1={m.t - 2} y2={H - m.b + 2} style={{ stroke: 'var(--line2)' }} />
        <text x={cx} y={H - 3} textAnchor="middle" fontSize="11" fontFamily={MONO} style={{ fill: 'var(--dim)' }}>0</text>
        {items.map(([label, v, color, text, light], i) => {
          const y0 = m.t + i * rowH; const val = v ?? 0;
          const x1 = x(Math.min(0, val)); const x2 = x(Math.max(0, val));
          return (
            <g key={label}>
              <text x={0} y={y0 + 16} fontSize="12" style={{ fill: 'var(--text2)' }}>{label}</text>
              <rect x={x1} y={y0 + 5} width={Math.max(1, x2 - x1)} height="14" style={{ fill: color, stroke: color }} fillOpacity={light ? 0.55 : 1} strokeWidth={light ? 1.5 : 0}>
                <title>{`${label}: ${text}`}</title>
              </rect>
              <text x={val < 0 ? x1 - 4 : x2 + 4} y={y0 + 16} textAnchor={val < 0 ? 'end' : 'start'} fontSize="11" fontFamily={MONO} style={{ fill: 'var(--text2)' }}>{text}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <ChartFrame id="cmp-chart-delta" title={t('compare.charts.c2.title', { n: delayDays })} what={t('compare.charts.c2.what', { n: delayDays })}
      legend={[
        [<Swatch key="s" color={SUN} />, t('common.sun')],
        [<Swatch key="e" color={EARTH} />, t('common.earth')],
        [<Swatch key="c" color={EARTH} kind="light" />, cap(t('common.commShort'))],
      ]}
      table={{
        head: [t('charts.site'), `${t('common.sun')} (h)`, `${t('common.earth')} (h)`, `${t('common.commShort')} (h)`, `${t('power.batteryShort')} (kWh)`],
        rows: rows.map((r) => [`${r.who} · ${siteName(r.site)}`, signed(r.hours.sun), signed(r.hours.earth), signed(r.hours.comm), batt(r)]),
      }}>
      {(w) => {
        const two = w >= 760; const pw = two ? (w - 24) * 0.62 : w; const bw = two ? (w - 24) * 0.38 : w;
        const hourItems = ['sun', 'earth', 'comm'].flatMap((k) => rows.map((r) => [`${r.who} · ${metricShort(t, k)}`, r.hours[k], COLOR[k], signed(r.hours[k]), k === 'comm']));
        // On narrow screens the battery rows are labelled A / B only (the names are in the legend of chart 1 and the table).
        const battItems = rows.filter((r) => r.battery).map((r) => [bw < 480 ? r.who : `${r.who} · ${siteShort(r.site)}`, r.battery.value, SUN, batt(r), false]);
        return (
          <div role="img" aria-label={summary} className={`flex ${two ? 'flex-row gap-6' : 'flex-col gap-4'}`}>
            {panel(pw, t('compare.charts.c2.hours'), hourItems, hoursMax)}
            {battItems.length > 0 && panel(bw, t('compare.charts.c2.battery'), battItems, kwhMax)}
          </div>
        );
      }}
    </ChartFrame>
  );
}

/** The two charts above the Compare table (same data as the table; no new request). */
export default function CompareCharts({ a, b, resultA, resultB, delayDays }) {
  const { t, siteName, siteShort } = useApp();
  const groups = groupedBars(a, b, resultA, resultB);
  const rows = deltaRows(a, b);
  if (!groups.length || !rows.length) return null;
  const names = { A: siteShort(a?.scenarios?.[0]?.site), B: siteShort(b?.scenarios?.[0]?.site) };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-2" aria-label={t('compare.charts.region')} role="region">
      <OriginalVsDelayed groups={groups} delayDays={delayDays} names={names} />
      <DelayChanges rows={rows} delayDays={delayDays} />
    </div>
  );
}
