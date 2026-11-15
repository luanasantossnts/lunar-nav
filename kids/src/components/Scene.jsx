// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { skylineAt, DATA } from '../lib/data.js';

const W = 720;
const H = 300;
const ZERO = 190; // y of the 0° horizon line

/**
 * A strip of sky seen from a site: the real terrain skyline (NASA LOLA) between two azimuths and the
 * Sun or Earth at its real position (JPL Horizons). The body is drawn first, then the mountains, so a
 * body behind a ridge is really hidden. Heights are stretched so the low mountains can be seen; the
 * caller shows how much (`exaggeration`).
 */
export function sceneScale(siteId, from, to, bodyEls = []) {
  const els = [];
  for (let az = from; az <= to; az += (to - from) / 180) els.push(skylineAt(siteId, az));
  const maxAbs = Math.max(2, ...els.map(Math.abs), ...bodyEls.map(Math.abs));
  const k = 150 / maxAbs; // px per degree, vertical
  const pxPerDegH = W / (to - from);
  return { k, exaggeration: Math.max(1, Math.round(k / pxPerDegH)) };
}

export default function Scene({ siteId, from = 0, to = 360, body, az, el, label, dirs, k }) {
  const span = to - from;
  const x = (a) => (((((a - from) % 360) + 360) % 360) / span) * W;
  const y = (e) => ZERO - e * k;
  const pts = [];
  for (let i = 0; i <= 240; i++) {
    const a = from + (i / 240) * span;
    pts.push(`${((i / 240) * W).toFixed(1)},${y(skylineAt(siteId, a)).toFixed(1)}`);
  }
  const ridge = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  const bx = x(az);
  const by = y(el);
  const ticks = [0, 90, 180, 270].filter((a) => x(a) >= 0 && x(a) <= W && (span >= 360 || ((a - from + 360) % 360) <= span));
  const sunId = `sun-${siteId}`;
  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`sky-${siteId}-${body}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05071c" />
          <stop offset="1" stopColor="#1b1650" />
        </linearGradient>
        <linearGradient id={`rock-${siteId}-${body}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b3d6" />
          <stop offset="0.45" stopColor="#8e86b5" />
          <stop offset="1" stopColor="#4a4478" />
        </linearGradient>
        <radialGradient id={sunId}>
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="0.5" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#ffa31a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${siteId}-${body})`} />
      {/* the flat 0° horizon, for reference */}
      <line x1="0" x2={W} y1={ZERO} y2={ZERO} stroke="#ffffff" strokeOpacity="0.25" strokeDasharray="6 8" />
      {body === 'sun' && (
        <g>
          <circle className="sun-glow" cx={bx} cy={by} r="34" fill={`url(#${sunId})`} />
          <circle cx={bx} cy={by} r="15" fill="#ffd75e" />
        </g>
      )}
      {body === 'earth' && (
        <g>
          <circle cx={bx} cy={by} r="20" fill="#4fb3ff" />
          <path d={`M${bx - 11},${by - 6} q6 -9 13 -3 q4 6 -3 10 q-7 3 -10 -7z M${bx + 4},${by + 6} q8 -2 10 4 q-5 6 -11 2z`} fill="#4cd38a" />
          <circle cx={bx} cy={by} r="20" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" />
        </g>
      )}
      <path d={ridge} fill={`url(#rock-${siteId}-${body})`} stroke="#d9d4f2" strokeWidth="1.5" />
      {ticks.map((a) => (
        <text key={a} x={Math.min(W - 22, Math.max(22, x(a)))} y={H - 14} textAnchor="middle" fontSize="34" fontWeight="800" fill="#fbf8ff" stroke="#1b1650" strokeWidth="4" paintOrder="stroke">{dirs[a]}</text>
      ))}
    </svg>
  );
}

export const SCENE_SITES = Object.keys(DATA.sites);
