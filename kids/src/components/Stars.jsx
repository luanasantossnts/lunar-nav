// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/** Decorative starry background (the same stars every time: a small fixed pseudo-random sequence). */
const STARS = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: 90 }, (_, i) => ({ x: rnd() * 1000, y: rnd() * 1000, r: 0.4 + rnd() * 1.0, d: `${(rnd() * 4).toFixed(2)}s`, k: i }));
})();

export default function Stars() {
  return (
    <svg className="stars" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {STARS.map((s) => <circle key={s.k} className="star" cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: s.d }} />)}
    </svg>
  );
}
