// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { useEffect, useState } from 'react';
import { skylineAt, DATA } from '../lib/data.js';

const W = 720;
const H = 300;
const ZERO = 190; // y of the flat 0° horizon

/** True on narrow screens, where the picture is small: the Sun and Earth are drawn bigger there. */
export function useNarrow(px = 640) {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(`(max-width: ${px}px)`) : null;
  const [narrow, setNarrow] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setNarrow(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return narrow;
}

/** Vertical scale: the low mountains and the body's path fit the picture; also how much taller they are drawn. */
export function sceneScale(siteId, from, to, bodyEls = []) {
  const els = [];
  for (let az = from; az <= to; az += (to - from) / 180) els.push(skylineAt(siteId, az));
  const maxAbs = Math.max(2, ...els.map(Math.abs), ...bodyEls.map(Math.abs));
  const k = 150 / maxAbs; // px per degree, vertical
  const pxPerDegH = W / (to - from);
  return { k, exaggeration: Math.max(1, Math.round(k / pxPerDegH)) };
}

// A few fixed stars in the scene's sky (decorative).
const SKY_STARS = [[40, 30], [120, 70], [210, 22], [300, 58], [380, 18], [460, 64], [540, 30], [630, 52], [690, 20], [90, 120], [520, 110], [250, 112]];

/**
 * A strip of sky seen from a site: the real terrain skyline (NASA LOLA) between two azimuths, and the
 * Sun or Earth at its real position (JPL Horizons). Back layer = the real skyline (it hides the body);
 * front layer = a lighter band that always stays below it (decoration only, never hides more).
 */
export default function Scene({ siteId, from = 0, to = 360, body, az, el, label, dirs, k }) {
  const narrow = useNarrow();
  const span = to - from;
  const x = (a) => (((((a - from) % 360) + 360) % 360) / span) * W;
  const y = (e) => ZERO - e * k;
  const back = []; const front = [];
  for (let i = 0; i <= 240; i++) {
    const a = from + (i / 240) * span;
    const sky = skylineAt(siteId, a);
    const px = ((i / 240) * W).toFixed(1);
    back.push(`${px},${y(sky).toFixed(1)}`);
    // front band: a smoother, lower copy of the skyline (always below it)
    const smooth = (skylineAt(siteId, a - span / 60) + sky + skylineAt(siteId, a + span / 60)) / 3;
    front.push(`${px},${Math.max(y(sky), y(smooth) + 26 + 10 * Math.sin(i / 9)).toFixed(1)}`);
  }
  const path = (pts) => `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  const bx = x(az);
  const by = y(el);
  const sunR = narrow ? 34 : 18;
  const earthR = narrow ? 50 : 26;
  const ticks = [0, 90, 180, 270].filter((a) => span >= 360 || ((a - from + 360) % 360) <= span);
  const g = `${siteId}-${body}`;
  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`sky-${g}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0b2b" />
          <stop offset="1" stopColor="#2a2668" />
        </linearGradient>
        <radialGradient id={`halo-${g}`}>
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="0.45" stopColor="#ffc94a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffc94a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${g})`} />
      {SKY_STARS.map(([sx, sy]) => <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r="2" fill="#ffffff" opacity="0.7" />)}
      <line x1="0" x2={W} y1={ZERO} y2={ZERO} stroke="#ffffff" strokeOpacity="0.25" strokeDasharray="6 8" />
      {body === 'sun' && (
        <g>
          <circle className="sun-glow" cx={bx} cy={by} r={sunR * 2.3} fill={`url(#halo-${g})`} />
          <circle cx={bx} cy={by} r={sunR} fill="#ffc94a" />
          <circle cx={bx - sunR * 0.3} cy={by - sunR * 0.3} r={sunR * 0.35} fill="#fff4d6" opacity="0.8" />
        </g>
      )}
      {body === 'earth' && (
        <g>
          <circle cx={bx} cy={by} r={earthR + 6} fill="#3ba7ff" opacity="0.25" />
          <circle cx={bx} cy={by} r={earthR} fill="#3ba7ff" />
          <path transform={`translate(${bx} ${by}) scale(${earthR / 26})`} d="M-15,-8 q8,-12 17,-4 q5,8 -4,13 q-9,4 -13,-9z M5,8 q10,-3 13,5 q-6,8 -14,3z M-6,14 q4,-2 6,2 q-3,3 -6,-2z" fill="#7fe0b8" />
        </g>
      )}
      <path d={path(back)} fill="#6e66b8" />
      <path d={path(front)} fill="#9e97d6" />
      {ticks.map((a) => (
        <text key={a} x={Math.min(W - 22, Math.max(22, x(a)))} y={H - 14} textAnchor="middle" fontSize="34" fontWeight="800" fill="#14123a">{dirs[a]}</text>
      ))}
    </svg>
  );
}

export const SCENE_SITES = Object.keys(DATA.sites);
