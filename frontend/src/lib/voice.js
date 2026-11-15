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
    .replace(/\*\*|\*|`/g, '')
    .replace(/(?<![\p{L}\p{N}])__?(?=\S)|(?<=\S)__?(?![\p{L}\p{N}])/gu, '') // _emphasis_, not snake_case ids
    .replace(/(?<=[\p{L}\p{N}])_(?=[\p{L}\p{N}])/gu, ' ') // snake_case ids are read as words
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

// Section titles in English, Portuguese and Spanish (same lists as Voice.php).
export const START_LABELS = 'conclusion|conclusión principal|conclusion principal|conclusión|conclusão|conclusao|bottom line|summary|in summary|em resumo|en resumen|resultado';
export const TRADE_LABELS = 'trade-off|tradeoff|trade off|compromiso|compensación|compensacion|compromisso|compensação|compensacao';
export const STOP_LABELS = 'assumptions|premissas|premisas|supuestos|hipóteses|hipoteses|hipótesis|hipotesis';

/** A section title at the start of a line: **Title:**, **Title**:, ## Title, or Title: (a bare word does not count). */
const label = (words) => {
  const w = `(?:${words})`;
  return new RegExp(`(?:^|\\n)[ \\t]*(?:#{1,6}[ \\t]*(?:\\*\\*|__)?${w}(?:\\*\\*|__)?[ \\t]*:?|(?:\\*\\*|__)[ \\t]*${w}[ \\t]*:?[ \\t]*(?:\\*\\*|__)[ \\t]*:?|${w}[ \\t]*:)`, 'iu');
};
const START = label(START_LABELS);
const TRADE = label(TRADE_LABELS);
const STOP = label(STOP_LABELS);

export function firstParagraph(md) {
  for (const p of String(md || '').split(/\n\s*\n/)) {
    const t = plain(p).trim();
    if (t && t.replace(/[^\p{L}]/gu, '').length >= 3) return t;
  }
  return '';
}

/** Conclusion + trade-off (up to the assumptions title); without any title, the first paragraph. ≤ 900 characters. */
export function summary(md) {
  const text = String(md || '');
  let part = null;
  const s = text.search(START);
  if (s >= 0) part = text.slice(s);
  else if (TRADE.test(text)) part = text;
  if (part !== null) {
    const e = part.search(STOP);
    if (e > 0) part = part.slice(0, e);
  }
  const p = part === null ? '' : plain(part);
  return clip(p || firstParagraph(text), SUMMARY_MAX);
}

export const spoken = (md, part) => (part === 'full' ? clip(plain(md), FULL_MAX) : summary(md));
