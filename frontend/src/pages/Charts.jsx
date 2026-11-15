// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { dateInput, ge, hrs, isoMin, num, NBSP, pct, pctSpan, numSpanBound } from '../lib/format.js';
import {
  CHART_SITES, SHORT, batteryRows, delayRows, monthlyLines, pgdaRows, siteBars, spreadLabels, sunHistogram, whereVsWhen, yearMean,
} from '../lib/charts.js';

import { ChartFrame, DASH, EARTH, Grid, MONO, SUN, Swatch, pctTick, pts } from '../components/ChartKit.jsx';

/* ---------- 1 · Sites side by side ---------- */
function SitesChart({ data, n }) {
  const { t, start, days } = useApp();
  const label = { sun: t('common.sunlight'), earth: t('common.earthInView'), comm: t('common.comm') };
  const color = { sun: SUN, earth: EARTH, comm: EARTH };
  const summary = data ? t('charts.c1.summary', { d: dateInput(start), n: days, list: data.map((s) => `${SHORT[s.id]}: ${s.bars.map((b) => `${label[b.key]} ${pct(b.value)}`).join(', ')}`).join('; ') }) : '';
  return (
    <ChartFrame id="chart-sites" n={n} title={t('charts.c1.title')} what={t('charts.c1.what', { d: dateInput(start), n: days })}
      status={!data ? t('common.loading') : null}
      legend={[[<Swatch key="s" color={SUN} />, label.sun], [<Swatch key="e" color={EARTH} />, label.earth], [<Swatch key="c" color={EARTH} kind="light" />, label.comm], [<Swatch key="w" kind="whisker" />, t('charts.discRange')], [<Swatch key="b" kind="box" />, t('charts.posRange')]]}
      table={data && { head: [t('charts.site'), t('charts.metric'), t('charts.value'), t('charts.discRange'), t('charts.posRange')],
        rows: data.flatMap((s) => s.bars.map((b) => [`${s.name}${s.mode === 'geometric' ? ` (${t('common.geometric')})` : ''}`, label[b.key], pct(b.value), b.disc ? pctSpan(b.disc[0], b.disc[1]) : '—', b.pos ? pctSpan(b.pos[0], b.pos[1]) : '—'])) }}>
      {(w) => {
        const H = 280; const m = { l: 44, r: 6, t: 10, b: 44 };
        const ih = H - m.t - m.b; const gw = (w - m.l - m.r) / data.length;
        const bw = Math.max(8, Math.min(26, (gw - 14) / 3));
        const y = (f) => m.t + (1 - f) * ih;
        return (
          <svg width={w} height={H} role="img" aria-label={summary} className="block">
            <Grid x0={m.l} x1={w - m.r} y={(v) => y(v / 100)} ticks={[0, 25, 50, 75, 100]} fmt={pctTick} />
            {data.map((s, i) => {
              const gx = m.l + i * gw + (gw - (3 * bw + 4)) / 2;
              return (
                <g key={s.id}>
                  {s.bars.map((b, k) => {
                    const x = gx + k * (bw + 2); const cx = x + bw / 2;
                    return (
                      <g key={b.key}>
                        <title>{`${s.name} · ${label[b.key]} ${pct(b.value)}`}</title>
                        <rect x={x} y={y(b.value)} width={bw} height={Math.max(0.5, y(0) - y(b.value))} style={{ fill: color[b.key], stroke: color[b.key] }} fillOpacity={b.key === 'comm' ? 0.35 : 1} strokeWidth={b.key === 'comm' ? 1.5 : 0} />
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
                  <text x={m.l + i * gw + gw / 2} y={H - m.b + 16} textAnchor="middle" fontSize={gw < 90 ? 11 : 12} style={{ fill: 'var(--text2)' }}>{gw < 90 && s.id === 'chandrayaan3' ? 'Ch-3' : SHORT[s.id]}</text>
                  {gw >= 90 && <text x={m.l + i * gw + gw / 2} y={H - m.b + 30} textAnchor="middle" fontSize="10" style={{ fill: 'var(--dim)' }}>{s.mode === 'geometric' ? t('common.geometric') : t('common.terrain')}</text>}
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/** Under chart 1 on narrow screens: what the short label and the horizon modes are. */
function SitesNote() {
  const { t } = useApp();
  return <p className="m-0 -mt-1 text-xs text-dim sm:hidden">{t('charts.c1.narrowNote')}</p>;
}

/* ---------- 2 · 2030 month by month ---------- */
function MonthlyChart({ lines, year, n }) {
  const { t, lang } = useApp();
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2030, i, 15)).replace('.', '')), [lang]);
  const narrow = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { month: 'narrow', timeZone: 'UTC' }).format(Date.UTC(2030, i, 15))), [lang]);
  const summary = lines?.length ? t('charts.c2.summary', { year, list: lines.map((l) => {
    const s = l.sun.filter((v) => v !== null); const e = l.earth.filter((v) => v !== null);
    return `${SHORT[l.id]}: ${t('common.sun')} ${pct(Math.min(...s))}–${pct(Math.max(...s))}, ${t('common.earth')} ${pct(Math.min(...e))}–${pct(Math.max(...e))}`;
  }).join('; ') }) : '';
  const panel = (w, key, color, title) => {
    const H = 210; const m = { l: 44, r: w < 500 ? 92 : 112, t: 22, b: 26 };
    const iw = w - m.l - m.r; const ih = H - m.t - m.b;
    const x = (i) => m.l + (i / 11) * iw; const y = (f) => m.t + (1 - f) * ih;
    const ends = spreadLabels(lines.map((l, k) => ({ id: l.id, k, y: y(l[key][11] ?? 0) + 4 })), 13, m.t + 4, H - m.b);
    return (
      <svg width={w} height={H} className="block" aria-hidden="true">
        <text x={m.l} y={13} fontSize="12" fontWeight="600" style={{ fill: 'var(--text2)' }}>{title}</text>
        <Grid x0={m.l} x1={m.l + iw} y={(v) => y(v / 100)} ticks={[0, 50, 100]} fmt={pctTick} />
        {(w < 560 ? narrow : months).map((mo, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" style={{ fill: 'var(--dim)' }}>{mo}</text>)}
        {lines.map((l, k) => (
          <g key={l.id}>
            <path d={l[key].map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v ?? 0).toFixed(1)}`).join(' ')} fill="none" style={{ stroke: color }} strokeWidth="2" strokeDasharray={DASH[k]} />
            {l[key].map((v, i) => <circle key={i} cx={x(i)} cy={y(v ?? 0)} r="2.5" style={{ fill: color }}><title>{`${l.name} · ${months[i]} ${year}: ${pct(v)}`}</title></circle>)}
          </g>
        ))}
        {ends.map((e) => <text key={e.id} x={m.l + iw + 8} y={e.y} fontSize="11" style={{ fill: 'var(--text2)' }}>{SHORT[e.id]}</text>)}
      </svg>
    );
  };
  return (
    <ChartFrame id="chart-monthly" n={n} title={t('charts.c2.title', { year })} what={t('charts.c2.what', { year })}
      status={!lines ? t('common.loading') : lines.length === 0 ? t('charts.unavailable') : null}
      legend={lines?.map((l, k) => [<Swatch key={l.id} color="var(--text2)" kind={`dash${k}`} />, `${l.name}${l.mode === 'geometric' ? ` (${t('common.geometric')})` : ''}`])}
      table={lines?.length && { head: [t('charts.month'), ...lines.flatMap((l) => [`${SHORT[l.id]} · ${t('common.sun')}`, `${SHORT[l.id]} · ${t('common.earth')}`])],
        rows: [...months.map((mo, i) => [`${mo} ${year}`, ...lines.flatMap((l) => [pct(l.sun[i]), pct(l.earth[i])])]),
          [t('charts.yearMean'), ...lines.flatMap((l) => [pct(yearMean(l.sun, year)), pct(yearMean(l.earth, year))])]] }}>
      {(w) => (
        <div role="img" aria-label={summary} className="flex flex-col gap-4">
          {panel(w, 'sun', SUN, t('charts.c2.sun'))}
          {panel(w, 'earth', EARTH, t('charts.c2.earth'))}
        </div>
      )}
    </ChartFrame>
  );
}

/* ---------- 3 · Ours vs NASA PGDA ---------- */
function PgdaChart({ data, siteName, n }) {
  const { t } = useApp();
  const summary = data ? t('charts.c3.summary', { year: data.year, same: data.sameRanking ? t('method.pgda.yes') : t('method.pgda.no'), list: data.rows.map((r) => `${SHORT[r.id]}: ${pct(r.sunOurs)} vs ${pct(r.sunPgda)} (${pts(r.sunDelta)})`).join('; ') }) : '';
  const panel = (w, key, color, title) => {
    const rowH = 30; const m = { l: 100, r: 74, t: 22, b: 8 };
    const H = m.t + data.rows.length * rowH + m.b; const iw = w - m.l - m.r;
    const x = (f) => m.l + f * iw;
    return (
      <svg width={w} height={H} className="block" aria-hidden="true">
        <text x={0} y={13} fontSize="12" fontWeight="600" style={{ fill: 'var(--text2)' }}>{title}</text>
        <text x={w} y={13} textAnchor="end" fontSize="11" style={{ fill: 'var(--dim)' }}>Δ {t('charts.points')}</text>
        {data.rows.map((r, i) => {
          const y0 = m.t + i * rowH; const ours = r[`${key}Ours`]; const pg = r[`${key}Pgda`]; const d = r[`${key}Delta`];
          return (
            <g key={r.id}>
              <text x={0} y={y0 + 17} fontSize="12" style={{ fill: 'var(--text2)' }}>{SHORT[r.id]}</text>
              <rect x={m.l} y={y0 + 3} width={Math.max(0.5, x(ours) - m.l)} height="10" style={{ fill: color }}><title>{`${siteName(r.id)} · ${t('charts.ours')} ${pct(ours)}`}</title></rect>
              <rect x={m.l} y={y0 + 15} width={Math.max(0.5, x(pg) - m.l)} height="10" style={{ fill: color, stroke: color }} fillOpacity="0.3" strokeWidth="1.2"><title>{`${siteName(r.id)} · NASA PGDA ${pct(pg)}`}</title></rect>
              <text x={w} y={y0 + 17} textAnchor="end" fontSize="12" fontFamily={MONO} style={{ fill: Math.abs(d) > 10 ? 'var(--alert)' : 'var(--text2)' }}>{pts(d)}</text>
            </g>
          );
        })}
      </svg>
    );
  };
  return (
    <ChartFrame id="chart-pgda" n={n} title={t('charts.c3.title')} what={t('charts.c3.what', { year: data?.year ?? 2030 })}
      status={!data ? t('common.loading') : null}
      legend={[[<Swatch key="o" color="var(--text2)" />, t('charts.ours')], [<Swatch key="p" color="var(--text2)" kind="light" />, 'NASA PGDA (18.6 yr)']]}
      table={data && { head: [t('charts.site'), `${t('common.sun')} · ${t('charts.ours')}`, `${t('common.sun')} · PGDA`, 'Δ', `${t('common.earth')} · ${t('charts.ours')}`, `${t('common.earth')} · PGDA`, 'Δ'],
        rows: data.rows.map((r) => [siteName(r.id), pct(r.sunOurs), pct(r.sunPgda), pts(r.sunDelta), pct(r.earthOurs), pct(r.earthPgda), pts(r.earthDelta)]) }}>
      {(w) => (
        <div role="img" aria-label={summary} className="flex flex-col gap-4">
          <p className="m-0 text-sm"><span className="font-medium">{t('charts.c3.ranking', { same: data.sameRanking ? t('method.pgda.yes') : t('method.pgda.no') })}</span> <span className="text-text2">{data.ranking.map((id) => SHORT[id] || id).join(' > ')}</span></p>
          {panel(w, 'sun', SUN, t('charts.c3.sun'))}
          {panel(w, 'earth', EARTH, t('charts.c3.earth'))}
        </div>
      )}
    </ChartFrame>
  );
}

/* ---------- 4 · Battery needed by site ---------- */
function BatteryChart({ rows, wv, delayDays, n }) {
  const { t, power } = useApp();
  const summary = rows ? t('charts.c4.summary', { list: rows.map((r) => `${SHORT[r.id]}: ${ge(num(r.kwh, 2, 'kWh'), r.lowerBound)}${r.pos ? ` (±300${NBSP}m ${numSpanBound(r.pos[0], r.posLowerBound[0], r.pos[1], r.posLowerBound[1], 2, 'kWh')})` : ''}`).join('; ') }) : '';
  return (
    <ChartFrame id="chart-battery" n={n} title={t('charts.c4.title')} what={t('charts.c4.what', { panel: power.panel_w, surv: power.survival_w, dod: power.dod })}
      status={!rows ? t('common.loading') : null}
      legend={[[<Swatch key="b" color={SUN} />, t('power.battery')], [<Swatch key="x" kind="box" />, t('charts.posRange')]]}
      table={rows && { head: [t('charts.site'), t('power.battery'), t('charts.posRange'), t('common.longestDark')], rows: rows.map((r) => [r.name, ge(num(r.kwh, 2, 'kWh'), r.lowerBound), r.pos ? numSpanBound(r.pos[0], r.posLowerBound[0], r.pos[1], r.posLowerBound[1], 2, 'kWh') : '—', ge(hrs(r.nightH), r.lowerBound)]) }}>
      {(w) => {
        const rowH = 34; const m = { l: 100, r: 96, t: 6, b: 24 };
        const H = m.t + rows.length * rowH + m.b; const iw = w - m.l - m.r;
        const max = Math.max(...rows.map((r) => Math.max(r.kwh, r.pos ? r.pos[1] : 0))) * 1.05 || 1;
        const x = (v) => m.l + (v / max) * iw;
        const ticks = [0, max / 2, max].map((v) => Math.round(v));
        return (
          <div className="flex flex-col gap-3">
            {wv && (
              <p className="m-0 p-3 border border-line2 bg-panel text-sm leading-relaxed max-w-[78ch]">
                {/* The claim is checked per site against the data; exceptions are named with their numbers. */}
                {wv.holds && <strong className="block">{t('charts.c4.headline')}</strong>}
                {!wv.holds && wv.holdsAt.length > 0 && <strong className="block">{t('charts.c4.headlineSome', { k: wv.holdsAt.length, n: wv.rows.length, list: wv.holdsAt.map((id) => SHORT[id]).join(', ') })}</strong>}
                {wv.exceptions.map((r) => <span key={r.id} className="block">{t('charts.c4.except', { site: SHORT[r.id], w: num(r.width, 2, 'kWh'), d: num(r.delayChange, 2, 'kWh'), n: delayDays })}</span>)}
                <span className="block text-text2">{t('charts.c4.note', { w: num(wv.maxWidth, 2, 'kWh'), d: num(wv.maxDelayChange, 2, 'kWh'), n: delayDays })}</span>
              </p>
            )}
            <svg width={w} height={H} role="img" aria-label={summary} className="block">
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} style={{ stroke: 'var(--hair)' }} />
                  <text x={x(v)} y={H - 6} textAnchor="middle" fontSize="11" fontFamily={MONO} style={{ fill: 'var(--dim)' }}>{num(v, 0, 'kWh')}</text>
                </g>
              ))}
              {rows.map((r, i) => {
                const y0 = m.t + i * rowH;
                return (
                  <g key={r.id}>
                    <title>{`${r.name} · ${ge(num(r.kwh, 2, 'kWh'), r.lowerBound)}`}</title>
                    <text x={0} y={y0 + 20} fontSize="12" style={{ fill: 'var(--text2)' }}>{SHORT[r.id]}</text>
                    <rect x={m.l} y={y0 + 8} width={Math.max(0.5, x(r.kwh) - m.l)} height="16" style={{ fill: SUN }} />
                    {r.pos && <rect x={x(r.pos[0])} y={y0 + 4} width={Math.max(1, x(r.pos[1]) - x(r.pos[0]))} height="24" fill="none" style={{ stroke: 'var(--ink)' }} strokeDasharray="3 2" strokeWidth="1.2" />}
                    <text x={w} y={y0 + 21} textAnchor="end" fontSize="12" fontFamily={MONO} style={{ fill: 'var(--text2)' }}>{ge(num(r.kwh, 2, 'kWh'), r.lowerBound)}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      }}
    </ChartFrame>
  );
}

/* ---------- 5 · What a delay changes ---------- */
function DelayChart({ rows, delayDays, n }) {
  const { t } = useApp();
  const dl = (d) => ge(hrs(d.hours), d.lowerBound);
  const summary = rows ? t('charts.c5.summary', { n: delayDays, list: rows.map((r) => `${SHORT[r.id]}: ${dl(r.daylight[0])} → ${dl(r.daylight[1])}, ${t('common.comm')} ${pct(r.comm[0])} → ${pct(r.comm[1])}`).join('; ') }) : '';
  const panel = (w, title, color, vals, max, fmt) => {
    const rowH = 34; const m = { l: 100, r: 84, t: 22, b: 4 };
    const H = m.t + rows.length * rowH + m.b; const iw = w - m.l - m.r;
    const x = (v) => m.l + (Math.max(0, v) / max) * iw;
    return (
      <svg width={w} height={H} className="block" aria-hidden="true">
        <text x={0} y={13} fontSize="12" fontWeight="600" style={{ fill: 'var(--text2)' }}>{title}</text>
        {rows.map((r, i) => {
          const y0 = m.t + i * rowH; const [a, b] = vals(r);
          return (
            <g key={r.id}>
              <text x={0} y={y0 + 19} fontSize="12" style={{ fill: 'var(--text2)' }}>{SHORT[r.id]}</text>
              <rect x={m.l} y={y0 + 3} width={Math.max(0.5, x(a.v) - m.l)} height="11" style={{ fill: color }}><title>{`${r.name} · ${t('compare.original')} ${fmt(a)}`}</title></rect>
              <rect x={m.l} y={y0 + 16} width={Math.max(0.5, x(b.v) - m.l)} height="11" style={{ fill: color, stroke: color }} fillOpacity="0.3" strokeWidth="1.2"><title>{`${r.name} · ${t('compare.delayed', { n: delayDays })} ${fmt(b)}`}</title></rect>
              <text x={w} y={y0 + 12} textAnchor="end" fontSize="11" fontFamily={MONO} style={{ fill: 'var(--text2)' }}>{fmt(a)}</text>
              <text x={w} y={y0 + 25} textAnchor="end" fontSize="11" fontFamily={MONO} style={{ fill: 'var(--dim)' }}>{fmt(b)}</text>
            </g>
          );
        })}
      </svg>
    );
  };
  return (
    <ChartFrame id="chart-delay" n={n} title={t('charts.c5.title', { n: delayDays })} what={t('charts.c5.what', { n: delayDays })}
      status={!rows ? t('common.loading') : null}
      legend={[[<Swatch key="o" color="var(--text2)" />, t('compare.original')], [<Swatch key="d" color="var(--text2)" kind="light" />, t('compare.delayed', { n: delayDays })]]}
      table={rows && { head: [t('charts.site'), `${t('charts.c5.daylight')} · ${t('compare.original')}`, `${t('charts.c5.daylight')} · ${t('compare.delayed', { n: delayDays })}`, `${t('common.comm')} · ${t('compare.original')}`, `${t('common.comm')} · ${t('compare.delayed', { n: delayDays })}`],
        rows: rows.map((r) => [r.name, `${dl(r.daylight[0])}${r.daylight[0].darkAtLanding ? ` (${t('charts.c5.dark')})` : ''}`, `${dl(r.daylight[1])}${r.daylight[1].darkAtLanding ? ` (${t('charts.c5.dark')})` : ''}`, pct(r.comm[0]), pct(r.comm[1])]) }}>
      {(w) => {
        const two = w >= 760; const pw = two ? (w - 24) / 2 : w;
        const maxH = Math.max(1, ...rows.flatMap((r) => r.daylight.map((d) => d.hours)));
        return (
          <div role="img" aria-label={summary} className={`flex ${two ? 'flex-row gap-6' : 'flex-col gap-4'}`}>
            {panel(pw, t('charts.c5.daylight'), SUN, (r) => r.daylight.map((d) => ({ v: d.hours, d })), maxH, (o) => dl(o.d))}
            {panel(pw, t('common.comm'), EARTH, (r) => r.comm.map((v) => ({ v: v ?? 0, raw: v })), 1, (o) => pct(o.raw))}
          </div>
        );
      }}
    </ChartFrame>
  );
}

/* ---------- 6 · Sensitivity histogram ---------- */
function HistogramChart({ h, site, n }) {
  const { t } = useApp();
  const summary = h ? t('charts.c6.summary', { site: site?.name ?? '', n: h.n, m: h.radius, p10: pct(h.p10), p90: pct(h.p90), point: pct(h.sitePoint) }) : '';
  return (
    <ChartFrame id="chart-hist" n={n} title={t('charts.c6.title')} what={t('charts.c6.what', { site: site?.name ?? '—', m: h?.radius ?? 300 })}
      status={h === undefined ? t('common.loading') : h === null ? t('charts.c6.none') : null}
      legend={[[<Swatch key="b" color={SUN} />, t('charts.c6.points')], [<Swatch key="v" kind="vline" />, t('charts.c6.sitePoint')], [<Swatch key="d" kind="vdash" />, 'P10 · P90']]}
      table={h && { head: [t('common.sunlight'), t('charts.c6.count')], rows: h.counts.map((c, i) => [pctSpan(h.edges[i], h.edges[i + 1], 0), String(c)]) }}>
      {(w) => {
        const H = 256; const m = { l: 40, r: 26, t: 40, b: 30 };
        const iw = w - m.l - m.r; const ih = H - m.t - m.b;
        const maxC = Math.max(1, ...h.counts);
        const x = (f) => m.l + f * iw; const y = (c) => m.t + (1 - c / maxC) * ih;
        const bw = iw / h.counts.length;
        const yTicks = [...new Set([0, Math.ceil(maxC / 2), maxC])];
        const marks = [[h.sitePoint, t('charts.c6.sitePoint'), ''], [h.p10, 'P10', '3 2'], [h.p90, 'P90', '3 2']].filter(([v]) => v !== null && v !== undefined);
        return (
          <svg width={w} height={H} role="img" aria-label={summary} className="block">
            <Grid x0={m.l} x1={w - m.r} y={y} ticks={yTicks} fmt={(v) => String(v)} />
            {h.counts.map((c, i) => (
              <rect key={i} x={x(h.edges[i]) + 1} y={y(c)} width={Math.max(1, bw - 2)} height={y(0) - y(c)} style={{ fill: SUN }}>
                <title>{`${pctSpan(h.edges[i], h.edges[i + 1], 0)}: ${c}`}</title>
              </rect>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={x(f)} y={H - 10} textAnchor={f === 1 ? 'end' : f === 0 ? 'start' : 'middle'} fontSize="11" fontFamily={MONO} style={{ fill: 'var(--dim)' }}>{pctTick(Math.round(f * 100))}</text>)}
            {marks.map(([v, lab, dash], k) => (
              <g key={lab}>
                <line x1={x(v)} x2={x(v)} y1={k === 0 ? 16 : m.t - 4} y2={y(0)} style={{ stroke: 'var(--ink)' }} strokeWidth={dash ? 1.5 : 2} strokeDasharray={dash} />
                {/* Site point label on its own top row; P10 left of its line, P90 right of its line. */}
                <text x={k === 0 ? (x(v) > w / 2 ? x(v) - 4 : x(v) + 4) : x(v) + (k === 2 ? 4 : -4)} y={k === 0 ? 12 : m.t - 8}
                  textAnchor={k === 0 ? (x(v) > w / 2 ? 'end' : 'start') : k === 2 && x(v) < w - 40 ? 'start' : 'end'} fontSize="11" style={{ fill: 'var(--text2)' }}>{k === 0 ? `${lab} ${pct(v)}` : lab}</text>
              </g>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

export default function Charts() {
  const { t, sites, A, start, days, delayDays, earthMargin, power } = useApp();
  const [metrics, setMetrics] = useState(null);
  const [delays, setDelays] = useState(null);
  const [year, setYear] = useState(null);
  const [validation, setValidation] = useState(null);
  const [sens, setSens] = useState(undefined);
  const [err, setErr] = useState('');
  const chartSites = useMemo(() => CHART_SITES.map(([id, mode]) => [sites.find((s) => s.id === id), mode]).filter(([s]) => s), [sites]);

  useEffect(() => {
    if (!chartSites.length) return undefined;
    let live = true;
    const o = { start: dateInput(start), days, earthMargin, power, spread: true };
    setMetrics(null); setDelays(null);
    Promise.all(chartSites.map(([s, mode]) => api.metrics(s, { ...o, mode }))).then((r) => live && setMetrics(r)).catch((e) => live && setErr(e.message));
    Promise.all(chartSites.map(([s, mode]) => api.delay(s, { start: o.start, days, delayDays, mode, earthMargin, power }))).then((r) => live && setDelays(r)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [chartSites, start, days, delayDays, earthMargin, power]);
  useEffect(() => { api.chartsYear(2030).then(setYear).catch(() => setYear({ sites: [] })); api.validation().then(setValidation).catch(() => setValidation({ checks: [] })); }, []);
  useEffect(() => {
    if (!A) return undefined;
    let live = true;
    setSens(undefined);
    api.sensitivity(A, { start: dateInput(start), days, power }).then((d) => live && setSens(d)).catch(() => live && setSens(null));
    return () => { live = false; };
  }, [A, start, days, power]);

  const siteName = (id) => sites.find((s) => s.id === id)?.name || id;
  const bars = metrics ? siteBars(metrics) : null;
  const battery = metrics ? batteryRows(metrics) : null;
  const wv = battery && delays ? whereVsWhen(battery, delays) : null;
  const lines = year ? monthlyLines(year) : null;
  const pg = validation ? pgdaRows(validation) : null;
  const hist = sens === undefined ? undefined : sunHistogram(sens);

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      <div>
        <h1 className="m-0 text-[28px] font-semibold tracking-tight">{t('charts.title')}</h1>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-text2 max-w-[78ch]">{t('charts.intro', { d: dateInput(start), n: days })}</p>
        {metrics?.[0] && <p className="m-0 mt-2 font-mono text-xs text-dim">{metrics[0].provenance.source} · {isoMin(metrics[0].metrics.period.start)} → {isoMin(metrics[0].metrics.period.end)} · {t('charts.modeNote')}</p>}
      </div>
      {err && <p role="alert" className="m-0 text-sm text-warntext">{err}</p>}
      <SitesChart data={bars} n={1} />
      {bars && <SitesNote />}
      <MonthlyChart lines={lines} year={year?.year ?? 2030} n={2} />
      <PgdaChart data={pg} siteName={siteName} n={3} />
      <BatteryChart rows={battery} wv={wv} delayDays={delayDays} n={4} />
      <DelayChart rows={delays ? delayRows(delays) : null} delayDays={delayDays} n={5} />
      <HistogramChart h={hist} site={A} n={6} />
    </div>
  );
}

