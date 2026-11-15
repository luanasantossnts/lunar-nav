// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { degRange, fixed } from '../lib/format.js';
import { horizonAt } from '../lib/visibility.js';

const W = 1000;
const H = 220;
const PAD = { l: 44, r: 10, t: 12, b: 22 };

/** Sun and Earth elevation over the stay at one site, with the horizon at each body's azimuth. */
export default function ElevationChart({ which = 'A' }) {
  const { t, results, cursor, start, days, terrain } = useApp();
  const r = results[which];
  if (!r?.series) return null;
  const end = start + days * 86400;
  const mask = r.provenance.horizon.mode === 'terrain' ? terrain[r.site.id]?.mask : null;
  const all = [...r.series.sun, ...r.series.earth].map((x) => x[2]);
  const hi = Math.min(90, Math.max(4, Math.ceil(Math.max(...all) + 1)));
  const lo = Math.max(-90, Math.min(-2, Math.floor(Math.min(...all) - 1)));
  const x = (tt) => PAD.l + ((tt - start) / (end - start)) * (W - PAD.l - PAD.r);
  const y = (el) => PAD.t + ((hi - el) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = (rows, f = (row) => row[2]) => rows.map((row, i) => `${i ? 'L' : 'M'}${x(row[0]).toFixed(1)} ${y(f(row)).toFixed(1)}`).join(' ');
  const ticks = [hi, (hi + lo) / 2 > 0 ? Math.round((hi + lo) / 2) : 0, lo].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <figure className="m-0 px-4 py-3">
      <figcaption className="panel-title mb-2">{t('planner.elevation')} · {r.site.name}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={r ? t('common.elevSummary', { s: degRange(r.metrics.sun.elevation.min, r.metrics.sun.elevation.max), e: degRange(r.metrics.earth.elevation.min, r.metrics.earth.elevation.max) }) : `${t('common.sunElevation')} / ${t('common.earthElevation')}`}>
        {[...ticks, 0].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: v === 0 ? 'var(--line2)' : 'var(--hair)' }} strokeDasharray={v === 0 ? '6 5' : undefined} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fontFamily="IBM Plex Mono, monospace" style={{ fill: 'var(--dim)' }}>{fixed(v)}°</text>
          </g>
        ))}
        {mask && <path d={line(r.series.sun, (row) => horizonAt(mask, row[1]))} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth="1" strokeDasharray="2 3" />}
        <path d={line(r.series.sun)} fill="none" style={{ stroke: 'var(--sun)' }} strokeWidth="1.75" />
        <path d={line(r.series.earth)} fill="none" style={{ stroke: 'var(--earth)' }} strokeWidth="1.75" />
        {cursor && <line x1={x(cursor)} x2={x(cursor)} y1={PAD.t} y2={H - PAD.b} style={{ stroke: 'var(--ink)' }} />}
      </svg>
      <div className="flex gap-4 text-xs font-mono">
        <span style={{ color: 'var(--sun)' }}>— {t('common.sun')}</span>
        <span style={{ color: 'var(--earth)' }}>— {t('common.earth')}</span>
        {mask && <span className="text-muted">··· {t('sky.skyline')}</span>}
      </div>
    </figure>
  );
}
