// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useApp } from '../lib/store.jsx';
import { fixed, pct, plain } from '../lib/format.js';
import { bodyStatus, horizonAt } from '../lib/visibility.js';
import { statusWord } from './SiteReadout.jsx';

const W = 1200;

/** Azimuth to x with north in the middle (south at both edges). */
const ax = (az) => ((((az - 180) % 360) + 360) % 360) / 360 * W;

function polyline(rows, y) {
  let d = '';
  let prev = null;
  for (const r of rows) {
    const x = ax(r[1]);
    const cmd = prev === null || Math.abs(x - prev) > W / 2 ? 'M' : 'L';
    d += `${cmd}${x.toFixed(1)} ${y(r[2]).toFixed(1)} `;
    prev = x;
  }
  return d;
}

/**
 * 360° horizon panorama for one scenario result: Sun and Earth paths over the stay,
 * their positions at the cursor, the smooth-sphere horizon and, when available,
 * the NASA LOLA skyline (which hides the bodies drawn behind it).
 */
/** Skyline polyline points across the panorama, interpolated exactly like the status (horizonAt). */
function skylinePoints(m, y) {
  const pts = [];
  for (let i = 0; i <= 720; i++) pts.push([(i / 720) * W, y(horizonAt(m, 180 + i * 0.5))]);
  return pts;
}

export default function SkyPanorama({ result, mask, refMask = null, height = 520, compact = false }) {
  const { t, cursor, earthMargin } = useApp();
  if (!result?.series) return null;
  const { sun, earth } = result.series;
  const H = height;
  // In geometric mode the real skyline is still drawn, as a discreet reference (refMask).
  const ref = !mask && refMask ? refMask : null;
  const els = [...sun, ...earth].map((r) => r[2]).concat(mask ? mask.elevations : []).concat(ref ? ref.elevations : []);
  const top = Math.min(90, Math.max(8, Math.ceil(Math.max(...els) + 1)));
  const bottom = -Math.max(4, Math.min(12, Math.round(top * 0.2)));
  const y = (el) => ((top - el) / (top - bottom)) * H;
  const exaggerated = top <= 15;
  const ex = exaggerated ? Math.max(1, Math.round((H / (top - bottom)) / (W / 360))) : 1; // vertical px/deg ÷ horizontal px/deg
  const sNow = cursor ? bodyStatus(sun, mask, cursor) : null;
  const eNow = cursor ? bodyStatus(earth, mask, cursor, earthMargin) : null;
  const skyline = mask ? skylinePoints(mask, y) : null;
  const refLine = ref ? skylinePoints(ref, y) : null;
  const gridEls = [];
  for (let v = Math.ceil(bottom / 2) * 2; v <= top; v += top > 20 ? 10 : 2) gridEls.push(v);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img"
        aria-label={t('sky.panoramaSummary', { title: t('sky.panorama'), p: pct(result?.metrics?.sun?.fraction), s: statusWord(t, sNow), e: statusWord(t, eNow) })}>
        {gridEls.map((v) => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--hair)' }} />)}
        {[0, 90, 180, 270].map((a) => <line key={a} x1={(a / 360) * W} x2={(a / 360) * W} y1="0" y2={H} style={{ stroke: a === 180 ? 'var(--line)' : 'var(--hair)' }} />)}
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--dim)' }} strokeDasharray="6 5" />
        <path d={polyline(earth, y)} fill="none" style={{ stroke: 'var(--earth)' }} strokeWidth="1.25" opacity="0.55" />
        <path d={polyline(sun, y)} fill="none" style={{ stroke: 'var(--sun)' }} strokeWidth="1.25" opacity="0.55" />
        {eNow && <circle cx={ax(eNow.az)} cy={y(eNow.el)} r={compact ? 12 : 15} style={{ fill: 'var(--earth)' }} />}
        {sNow && <circle cx={ax(sNow.az)} cy={y(sNow.el)} r={compact ? 6 : 8} style={{ fill: 'var(--sun)' }} />}
        {skyline && (
          <>
            <path d={`M0 ${H} ${skyline.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} L${W} ${H} Z`} style={{ fill: 'var(--terrain)' }} />
            <path d={skyline.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth="1.25" />
          </>
        )}
        {!skyline && <rect x="0" y={y(0)} width={W} height={H - y(0)} style={{ fill: 'var(--terrain)' }} opacity="0.85" />}
        {refLine && <path d={refLine.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth="1" strokeDasharray="1.5 3" opacity="0.9" />}
        {/* Start (open ring) and end (dot) of each path over the period: explains the jump where the path does not close. */}
        {[[sun, 'var(--sun)'], [earth, 'var(--earth)']].map(([rows, c]) => {
          if (!rows.length) return null;
          const s0 = rows[0];
          const s1 = rows[rows.length - 1];
          // Start label to the right, end label to the left, each on the side away from the other point.
          const endAbove = y(s1[2]) <= y(s0[2]);
          const lab = (r, txt, right, dy) => (
            <text x={ax(r[1]) + (right ? 9 : -9)} y={y(r[2]) + dy} textAnchor={right ? 'start' : 'end'} fontSize="12" fontFamily="IBM Plex Mono, monospace"
              style={{ fill: c, paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}>{txt}</text>
          );
          return (
            <g key={c} aria-hidden="true">
              <circle cx={ax(s0[1])} cy={y(s0[2])} r="5" fill="none" style={{ stroke: c }} strokeWidth="1.75" />
              <circle cx={ax(s1[1])} cy={y(s1[2])} r="3.5" style={{ fill: c }} />
              {!compact && lab(s0, t('sky.trackStart'), ax(s0[1]) < W - 60, endAbove ? 16 : -8)}
              {!compact && lab(s1, t('sky.trackEnd'), ax(s1[1]) < 50, endAbove ? -8 : 16)}
            </g>
          );
        })}
        {gridEls.filter((v) => v !== 0).map((v) => (
          <text key={`l${v}`} x="6" y={y(v) - 3} fontSize="12" fontFamily="IBM Plex Mono, monospace" style={{ fill: 'var(--dim)' }}>{v > 0 ? '+' : ''}{fixed(v)}°</text>
        ))}
      </svg>
      <div className="flex justify-between px-1 pt-1 font-mono text-[11px] text-dim">
        <span>180° {t('sky.axis.s')}</span><span>270° {t('sky.axis.w')}</span><span className="text-ink">0° {t('sky.axis.n')}</span><span>90° {t('sky.axis.e')}</span><span>180° {t('sky.axis.s')}</span>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs">
          <span style={{ color: 'var(--sun)' }}>● {t('common.sun')}</span>
          <span style={{ color: 'var(--earth)' }}>● {t('common.earth')}</span>
          <span className="text-dim">- - {t('sky.sphere')}</span>
          {skyline && <span className="text-muted">— {t('sky.skyline')} (NASA LOLA)</span>}
          {refLine && <span className="text-dim">··· {t('sky.skylineReference')}</span>}
          <span className="text-muted">{t('sky.trackLegend')}</span>
          {exaggerated && <span className="text-dim">{t('sky.exaggeration', { n: plain(ex) })}</span>}
        </div>
      )}
    </div>
  );
}
