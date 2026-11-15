// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeT } from './i18n.js';
import CachedBadge from '../components/CachedBadge.jsx';
import { errorText } from '../pages/Analyst.jsx';
import { FULL_MAX, SUMMARY_MAX, TTS_FALLBACK_CODES, shouldUseBrowserVoice, spoken, summary } from './voice.js';

const LANGS = ['en', 'pt', 'es'];
const ans = "**Conclusion:** Shackleton rim gets far more sunlight [1][2]. It stays lit for 555.7 h [1].\n\n**Trade-off:** IM-2 sees Earth for 80.2 % of the period [2].\n\n| Site | Sun |\n|---|---|\n| A | 99.8 % |\n\n**Assumptions:**\n- Visibility uses the body centre.";

describe('"cached answer" badge', () => {
  it('appears only on answers that came from the cache, in each language', () => {
    for (const l of LANGS) {
      const t = makeT(l);
      const html = renderToStaticMarkup(createElement(CachedBadge, { entry: { cached: true, cached_at: '2026-11-16' }, t }));
      expect(html, l).toContain('data-testid="cached-badge"');
      expect(html, l).toContain(t('analyst.cachedAnswer'));
      expect(html, l).toContain('2026-11-16');
      expect(renderToStaticMarkup(createElement(CachedBadge, { entry: { cached: false }, t }))).toBe('');
    }
    expect(makeT('pt')('analyst.cachedAnswer')).toBe('resposta em cache');
  });
});

describe('voice fallback', () => {
  it('uses the browser voice when ElevenLabs is off, or when its limits are reached', () => {
    const on = { voice: { tts: true } };
    expect(shouldUseBrowserVoice({ voice: { tts: false } }, null)).toBe(true);
    expect(shouldUseBrowserVoice(on, null)).toBe(false);
    for (const code of TTS_FALLBACK_CODES) expect(shouldUseBrowserVoice(on, { code })).toBe(true);
    expect(shouldUseBrowserVoice(on, new Error('network'))).toBe(true);
    expect(shouldUseBrowserVoice(on, { code: 'question_too_long' })).toBe(false);
  });
  it('the browser voice reads the same summary as the server (Conclusion + Trade-off)', () => {
    // Same example and expected text as the PHP test of Voice::summary.
    expect(summary(ans)).toBe('Conclusion: Shackleton rim gets far more sunlight. It stays lit for 555.7 h.\n\nTrade-off: IM-2 sees Earth for 80.2 % of the period.');
    expect(summary('**Conclusão:** A [1].\n\n**Trade-off:** B.\n\n**Premissas:** C.')).toBe('Conclusão: A.\n\nTrade-off: B.');
    expect(summary('**Conclusión:** A.\n\n**Supuestos:** C.')).toBe('Conclusión: A.');
    expect(summary('First paragraph here [1].\n\nSecond.')).toBe('First paragraph here.');
    expect(summary(`**Conclusion:** ${'This is a sentence of the summary. '.repeat(60)}`).length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(spoken('Line of text here. '.repeat(300), 'full').length).toBeLessThanOrEqual(FULL_MAX);
    expect(spoken(ans, 'full')).not.toContain('|');
  });
});

describe('limits: polite messages in three languages', () => {
  const codes = ['question_empty', 'question_too_long', 'analyst_ip', 'analyst_daily', 'analyst_unavailable', 'tts_ip', 'tts_daily', 'tts_unavailable', 'stt_ip', 'stt_daily', 'stt_too_long', 'stt_empty', 'stt_unavailable', 'bad_request', 'generic'];
  it('every API error code has a translated, non-technical message', () => {
    for (const l of LANGS) {
      const t = makeT(l);
      for (const c of codes) {
        const m = t(`limits.${c}`);
        expect(m, `${l} ${c}`).not.toBe(`limits.${c}`);
        expect(m, `${l} ${c}`).not.toMatch(/HTTP|\b(error|status) \d{3}\b|\b[45]\d\d\b(?! (characters|caracteres))|exception|stack/i);
      }
      expect(errorText(t, { code: 'analyst_daily' })).toBe(t('limits.analyst_daily'));
      expect(errorText(t, { code: 'unknown_code' })).toBe(t('limits.generic'));
      expect(errorText(t, new Error('Upstream error 500'))).toBe(t('limits.generic'));
    }
  });
  it('every code thrown by the API is translated', () => {
    const php = ['../../../api/src/App.php', '../../../api/src/Voice/Voice.php', '../../../api/src/Usage/Usage.php', '../../../api/src/Agent/Analyst.php']
      .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    const thrown = [...new Set([...php.matchAll(/new ApiError\('([a-z_]+)'/g), ...php.matchAll(/'(?:analyst|tts|stt)_[a-z]+'(?=\))/g)].map((m) => m[1] ?? m[0].slice(1, -1)))];
    const en = JSON.parse(readFileSync(new URL('../locales/en.json', import.meta.url), 'utf8')).limits;
    for (const c of thrown) expect(Object.keys(en), c).toContain(c);
  });
});

describe('suggested questions file for the warm-up script', () => {
  it('equals the questions in the locales', () => {
    const s = JSON.parse(readFileSync(new URL('../../../api/data/suggested.json', import.meta.url), 'utf8')).questions;
    for (const l of LANGS) {
      const a = JSON.parse(readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8')).analyst;
      expect(s[l], l).toEqual([a.ex1, a.ex2, a.ex3]);
    }
  });
});

describe('no other AI provider left in the app', () => {
  it('no GPT, Llama, OpenAI or Whisper in sources and locales', () => {
    const files = ['../pages/Analyst.jsx', './aiStatus.js', './api.js', '../locales/en.json', '../locales/pt.json', '../../../api/src/App.php', '../../../api/src/bootstrap.php', '../../../api/config.example.php', '../../../api/src/Voice/Voice.php', '../../../api/src/Agent/Analyst.php'];
    for (const f of files) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      // Old config keys are only named in bootstrap.php, in the comment that says they are ignored.
      const scan = f.endsWith('bootstrap.php') ? src.replace(/\/\/[^\n]*/g, '').replace(/'(gpt|llama|whisper)'/g, '') : src;
      expect(scan, f).not.toMatch(/\bGPT\b|\bLlama\b|OpenAI|Whisper|OPENAI_API_KEY|LLAMA_/);
    }
    const es = readFileSync(new URL('../locales/es.json', import.meta.url), 'utf8');
    expect(es).not.toMatch(/\bGPT\b|\bLlama\b|OpenAI|Whisper/); // "Llamadas" (calls) is Spanish, not the model
  });
});

describe('horizon mode default', async () => {
  const { DEFAULTS, initialMode } = await import('./store.jsx');
  it('defaults to terrain; the URL choice wins', () => {
    expect(DEFAULTS.mode).toBe('terrain');
    expect(initialMode(undefined)).toBe('terrain');
    expect(initialMode('geometric')).toBe('geometric');
    expect(initialMode('terrain')).toBe('terrain');
    expect(initialMode('bogus')).toBe('terrain');
  });
  it('the Briefing note no longer says the panorama is only the smooth sphere', () => {
    for (const l of LANGS) expect(makeT(l)('brief.note'), l).toMatch(/LOLA/);
  });
});
