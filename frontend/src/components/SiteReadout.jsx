// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { coord, degRange, discSpan, hrs, isoMin, pct, spreadSpan } from '../lib/format.js';
import { bodyStatus } from '../lib/visibility.js';
import { HorizonNote } from './States.jsx';
import { Label } from './HelpLink.jsx';
import Bound from './Bound.jsx';
import { longTermLine, showPsr } from '../lib/reference.js';

function Row({ label, value, color, sub }) {
  return (
    <>
      <dt className="text-text2">{label}</dt>
      <dd className="m-0 font-mono tabular text-right">
        <span style={color ? { color } : undefined}>{value}</span>
        {sub}
      </dd>
    </>
  );
}

/** Small lines under a fraction: disc range and, when known, the ±300 m position range. */
function Ranges({ t, dr, ps, body }) {
  const pos = ps?.available ? ps : null;
  return (
    <span className="block text-[11px] leading-snug text-dim">
      <span className="block" title={t('common.discTitle')}>{t('common.discRange', { r: discSpan(dr) })}</span>
      {pos && <span className="block" title={t('common.posTitle', { m: pos.radius_m })}>{t('common.posRange', { m: pos.radius_m, r: spreadSpan(pos, body) })}</span>}
    </span>
  );
}

export function statusWord(t, s) {
  if (!s) return '—';
  if (s.status === 'visible') return t('common.visible');
  if (s.status === 'margin') return t('common.belowMargin', { m: s.margin });
  return s.status === 'terrain' ? t('common.behindTerrain') : t('common.belowHorizon');
}

export default function SiteReadout({ which }) {
  const { t, results, cursor, terrain, earthMargin } = useApp();
  const r = results[which];
  if (!r) return <section className="p-4 border-b border-line text-sm text-muted">{results.loading ? t('common.loading') : '—'}</section>;
  const m = r.metrics;
  const mask = r.provenance.horizon.mode === 'terrain' ? terrain[r.site.id]?.mask : null;
  const sunNow = r.series && cursor ? bodyStatus(r.series.sun, mask, cursor) : null;
  const earthNow = r.series && cursor ? bodyStatus(r.series.earth, mask, cursor, earthMargin) : null;
  const accent = which === 'A' ? 'var(--sun)' : 'var(--earth)';
  // Terrain-grid spread only matches a terrain-mode centre value.
  const spread = r.provenance.horizon.mode === 'terrain' ? r.position_spread : null;
  const lt = m.reference_long_term;
  return (
    <section className="px-4 py-4 border-b border-line">
      <div className="flex justify-between items-baseline gap-2">
        <h2 className="panel-title m-0"><span style={{ color: accent }}>{which}</span> {r.site.name}</h2>
        <span className="font-mono text-xs text-muted whitespace-nowrap">{coord(r.site.lat, r.site.lon)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-[minmax(8.5rem,1fr)_auto] gap-x-3 gap-y-2 text-[13px]">
        {cursor && <Row label={t('common.atCursor')} value={`${t('common.sun')} ${statusWord(t, sunNow)} · ${t('common.earth')} ${statusWord(t, earthNow)}`} />}
        <Row label={<Label k="common.sunlight" />} value={pct(m.sun.fraction)} color="var(--sun)" sub={<Ranges t={t} dr={m.sun.disc_range} ps={spread} body="sun" />} />
        <Row label={<Label k="common.earthInView" />} value={`${pct(m.earth.fraction)} · ${hrs(m.earth.hours_per_day)} ${t('common.perDay')}`} color="var(--earth)" sub={<Ranges t={t} dr={m.earth.disc_range} ps={spread} body="earth" />} />
        <Row label={<Label k="common.both" />} value={pct(m.both.fraction)} sub={<Ranges t={t} dr={m.both.disc_range} ps={spread} body="both" />} />
        {m.comm && (
          <>
            <Row label={<span title={t('common.commTitle', { el: r.provenance.dsn?.min_elevation_deg ?? 10 })}><Label k="common.comm" /></span>}
              value={`${pct(m.comm.fraction)} · ${hrs(m.comm.hours_per_day)} ${t('common.perDay')}`} color="var(--earth)"
              sub={<Ranges t={t} dr={m.comm.disc_range} ps={spread} body="comm" />} />
            <Row label={<Label k="common.longestCommGap" />} value={<Bound flag={m.comm.longest_gap_lower_bound} gap>{hrs(m.comm.longest_gap_h)}</Bound>} />
          </>
        )}
        <Row label={<Label k="common.longestDark" />} value={<Bound flag={m.sun.longest_hidden_lower_bound}>{hrs(m.sun.longest_hidden_h)}</Bound>} />
        <Row label={<Label k="common.longestEarthGap" />} value={<Bound flag={m.earth.longest_hidden_lower_bound} gap>{hrs(m.earth.longest_hidden_h)}</Bound>} />
        <Row label={<Label k="common.sunElevation" />} value={degRange(m.sun.elevation.min, m.sun.elevation.max)} />
        <Row label={<Label k="common.earthElevation" />} value={degRange(m.earth.elevation.min, m.earth.elevation.max)} />
        <Row label={<Label k="common.nextSunset" />} value={m.sun.first_set ? isoMin(m.sun.first_set) : t('common.never')} />
        <Row label={<Label k="common.nextEarthset" />} value={m.earth.first_set ? isoMin(m.earth.first_set) : t('common.never')} />
        <Row label={<Label k="common.panelVertical" />} value={m.sun.panel_factor.vertical.toFixed(3)} />
        {/* Independent of the chosen dates: NASA PGDA's 18.6-year average at the site. */}
        {lt?.available && <Row label={<Label k="common.longTerm" />} value={longTermLine(t, lt)} />}
        {showPsr(lt) && <Row label={<Label k="common.psrNear" />} value={pct(lt.psr_fraction_300m)} />}
      </dl>
      <div className="mt-2 flex flex-col gap-0.5">
        <HorizonNote provenance={r.provenance} />
        {r.site.source && <span className="text-[11px] text-dim">{t('common.source')}: {r.site.source}</span>}
      </div>
    </section>
  );
}
