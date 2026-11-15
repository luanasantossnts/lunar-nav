// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Read-aloud helpers. The server decides what ElevenLabs speaks (Voice::spoken in PHP); this
 * mirrors it for the browser's own voice, used when ElevenLabs is not configured or its
 * allowance is used up. Same rules: Conclusion + Trade-off, no tables or citations, ≤ 900
 * characters (full answer ≤ 2 500).
 */
export const SUMMARY_MAX = 900;
export const FULL_MAX = 2500;
export const STT_MAX_SECONDS = 30;
export const STT_MAX_BYTES = 2_000_000;

/** Error codes after which the app falls back to the browser's voice (with a discreet note). */
export const TTS_FALLBACK_CODES = ['tts_daily', 'tts_ip', 'tts_unavailable'];
export const shouldUseBrowserVoice = (health, err) => !health?.voice?.tts || (err ? TTS_FALLBACK_CODES.includes(err.code) || !err.code : false);

export function plain(md) {
  return String(md || '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*\|/.test(l))
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, ''))
    .join('\n')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/[ \t]+([.,;:!?)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function clip(t, max) {
  const s = t.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.\n'));
  if (end > max * 0.5) return cut.slice(0, end + 1);
  const sp = cut.lastIndexOf(' ');
  return `${cut.slice(0, sp > 0 ? sp : max).replace(/[ ,;:]+$/, '')}…`;
}

const START = /(?:^|\n)\s*(?:\*\*|__)?\s*(?:conclusion|conclusão|conclusao|conclusión)\s*:?\s*(?:\*\*|__)?\s*:?/i;
const STOP = /(?:^|\n)\s*(?:\*\*|__)?\s*(?:assumptions|premissas|supuestos|premisas)\s*:?\s*(?:\*\*|__)?\s*:?/i;

export function summary(md) {
  const text = String(md || '');
  const s = text.search(START);
  if (s < 0) {
    const first = plain(text).split(/\n\s*\n/).map((p) => p.trim()).find(Boolean) || '';
    return clip(first, SUMMARY_MAX);
  }
  let part = text.slice(s);
  const e = part.search(STOP);
  if (e > 0) part = part.slice(0, e);
  return clip(plain(part), SUMMARY_MAX);
}

export const spoken = (md, part) => (part === 'full' ? clip(plain(md), FULL_MAX) : summary(md));
