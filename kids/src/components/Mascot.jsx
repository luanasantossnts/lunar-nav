// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Lumi, the Lunar Nav Kids guide: an original astronaut-robot drawn here in SVG (no existing
 * character). White round helmet, dark visor, mint eyes and smile, coral antenna ball, white body
 * with a coral panel. Awake: blinks, floats and waves. Asleep (the long night): eyes closed, "z z".
 * `face` draws only the helmet (for the tip strip). All animations stop under prefers-reduced-motion.
 */
const INK = '#1e1b52';
const MINT = '#4fd1a5';
const CORAL = '#ff7a59';
const LINE = '#c9c3e6';

function Head({ asleep }) {
  return (
    <g>
      {/* antenna */}
      <line x1="120" y1="32" x2="120" y2="14" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <circle className={asleep ? undefined : 'bulb'} cx="120" cy="11" r="9" fill={CORAL} />
      {/* helmet */}
      <circle cx="120" cy="86" r="62" fill="#ffffff" stroke={LINE} strokeWidth="4" />
      <rect x="68" y="58" width="104" height="62" rx="31" fill={INK} />
      <path d="M82 72 q14 -10 32 -8" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="5" fill="none" strokeLinecap="round" />
      {asleep ? (
        <g stroke={MINT} strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M92 90 q10 8 20 0" />
          <path d="M128 90 q10 8 20 0" />
          <path d="M112 106 q8 4 16 0" />
        </g>
      ) : (
        <g>
          <ellipse className="eye" cx="102" cy="88" rx="9" ry="11" fill={MINT} />
          <ellipse className="eye" cx="138" cy="88" rx="9" ry="11" fill={MINT} />
          <path d="M106 104 q14 11 28 0" stroke={MINT} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )}
      {/* ear pieces */}
      <rect x="50" y="74" width="14" height="26" rx="7" fill={LINE} />
      <rect x="176" y="74" width="14" height="26" rx="7" fill={LINE} />
    </g>
  );
}

export default function Mascot({ label, className = 'mascot', asleep = false, face = false }) {
  if (face) {
    return (
      <svg className={className} viewBox="40 0 160 156" role="img" aria-label={label}>
        <Head asleep={asleep} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 240 280" role="img" aria-label={label}>
      <ellipse cx="120" cy="268" rx="62" ry="8" fill="#000000" opacity="0.3" />
      <g className={asleep ? undefined : 'float'}>
        {/* backpack */}
        <rect x="60" y="140" width="120" height="86" rx="24" fill={LINE} />
        {/* body with a coral panel */}
        <rect x="70" y="134" width="100" height="96" rx="32" fill="#ffffff" stroke={LINE} strokeWidth="4" />
        <rect x="96" y="158" width="48" height="36" rx="10" fill={CORAL} />
        <circle cx="110" cy="176" r="5" fill="#ffffff" />
        <rect x="120" y="172" width="16" height="8" rx="4" fill="#ffffff" />
        {/* legs and boots */}
        <rect x="88" y="220" width="24" height="30" rx="10" fill="#ffffff" stroke={LINE} strokeWidth="4" />
        <rect x="128" y="220" width="24" height="30" rx="10" fill="#ffffff" stroke={LINE} strokeWidth="4" />
        <rect x="82" y="244" width="34" height="14" rx="7" fill={INK} />
        <rect x="124" y="244" width="34" height="14" rx="7" fill={INK} />
        {/* left arm */}
        <rect x="46" y="146" width="26" height="58" rx="13" fill="#ffffff" stroke={LINE} strokeWidth="4" />
        <circle cx="59" cy="208" r="11" fill={INK} />
        {/* right arm: waves when awake, rests when asleep */}
        {asleep ? (
          <g>
            <rect x="168" y="146" width="26" height="58" rx="13" fill="#ffffff" stroke={LINE} strokeWidth="4" />
            <circle cx="181" cy="208" r="11" fill={INK} />
          </g>
        ) : (
          <g className="arm">
            <rect x="168" y="98" width="26" height="62" rx="13" fill="#ffffff" stroke={LINE} strokeWidth="4" transform="rotate(28 156 152)" />
            <circle cx="198" cy="100" r="11" fill={INK} />
          </g>
        )}
        <Head asleep={asleep} />
        {asleep && (
          <g className="zz" fill={LINE} fontFamily="'Baloo 2', sans-serif" fontWeight="800">
            <text x="182" y="40" fontSize="28">z</text>
            <text x="202" y="20" fontSize="20">z</text>
          </g>
        )}
      </g>
    </svg>
  );
}
