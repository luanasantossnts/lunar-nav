// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Lumi, the Lunar Nav Kids guide: an original astronaut-robot drawn here in SVG (no existing
 * character). It blinks, floats and waves; the animations stop under prefers-reduced-motion.
 */
export default function Mascot({ label, className = 'mascot' }) {
  return (
    <svg className={className} viewBox="0 0 240 270" role="img" aria-label={label}>
      <defs>
        <linearGradient id="lumi-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f1ff" />
          <stop offset="1" stopColor="#c9c2f2" />
        </linearGradient>
        <linearGradient id="lumi-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b3a93" />
          <stop offset="1" stopColor="#141c55" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="258" rx="62" ry="8" fill="#000" opacity="0.35" />
      <g className="float">
        {/* antenna */}
        <line x1="120" y1="30" x2="120" y2="12" stroke="#e9e6ff" strokeWidth="5" strokeLinecap="round" />
        <circle className="bulb" cx="120" cy="10" r="8" fill="#ffc83d" />
        {/* backpack */}
        <rect x="58" y="138" width="124" height="86" rx="22" fill="#8e86b5" />
        {/* body */}
        <rect x="70" y="132" width="100" height="92" rx="30" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" />
        {/* chest badge: a small Moon */}
        <circle cx="120" cy="174" r="15" fill="#1d2a6b" />
        <circle cx="125" cy="170" r="10" fill="#ffc83d" />
        <circle cx="130" cy="167" r="9" fill="#1d2a6b" />
        {/* legs and boots */}
        <rect x="88" y="214" width="24" height="30" rx="10" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" />
        <rect x="128" y="214" width="24" height="30" rx="10" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" />
        <rect x="82" y="238" width="34" height="14" rx="7" fill="#5d5689" />
        <rect x="124" y="238" width="34" height="14" rx="7" fill="#5d5689" />
        {/* left arm (resting) */}
        <rect x="46" y="144" width="26" height="56" rx="13" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" />
        <circle cx="59" cy="204" r="11" fill="#5d5689" />
        {/* right arm (waving) */}
        <g className="arm">
          <rect x="166" y="96" width="26" height="60" rx="13" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" transform="rotate(28 152 150)" />
          <circle cx="196" cy="98" r="11" fill="#5d5689" />
        </g>
        {/* helmet */}
        <circle cx="120" cy="84" r="62" fill="url(#lumi-suit)" stroke="#8e86b5" strokeWidth="3" />
        <rect x="70" y="58" width="100" height="58" rx="29" fill="url(#lumi-visor)" />
        <path d="M84 70 q14 -10 30 -8" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* eyes and smile */}
        <ellipse className="eye" cx="102" cy="88" rx="8" ry="10" fill="#7fe3ff" />
        <ellipse className="eye" cx="138" cy="88" rx="8" ry="10" fill="#7fe3ff" />
        <path d="M108 104 q12 9 24 0" stroke="#7fe3ff" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* ears */}
        <rect x="52" y="74" width="14" height="24" rx="6" fill="#ffc83d" />
        <rect x="174" y="74" width="14" height="24" rx="6" fill="#ffc83d" />
      </g>
    </svg>
  );
}
