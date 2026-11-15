// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeT } from './i18n.js';
import { MIC_NOTICE_KEY, markMicNoticeSeen, micNoticeNeeded } from './privacy.js';

const fakeStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('microphone notice', () => {
  it('is shown the first time only, and remembered in the browser', () => {
    const s = fakeStore();
    expect(micNoticeNeeded(s)).toBe(true);
    markMicNoticeSeen(s);
    expect(s.m.get(MIC_NOTICE_KEY)).toBe('1');
    expect(micNoticeNeeded(s)).toBe(false);
  });
  it('is shown every time when the browser blocks storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(micNoticeNeeded(broken)).toBe(true);
    expect(() => markMicNoticeSeen(broken)).not.toThrow();
  });
  it('the Mic shows it on first use, before anything is sent', () => {
    const a = src('../pages/Analyst.jsx');
    expect(a).toMatch(/if \(micNoticeNeeded\(\)\) \{ setNotice\(true\); markMicNoticeSeen\(\); \}/);
    expect(makeT('en')('analyst.micNotice')).toBe('Your recording is sent to ElevenLabs (USA) for transcription and is not stored by Lunar Nav.');
  });
});

describe('privacy texts', () => {
  it('the Analyst notice (exact text) sits above the question box', () => {
    expect(makeT('en')('analyst.privacyNote')).toBe('Do not include personal data. Questions are sent to Anthropic (USA) to generate the answer and identical questions may be cached for 90 days.');
    const a = src('../pages/Analyst.jsx');
    expect(a.indexOf("t('analyst.privacyNote')")).toBeLessThan(a.indexOf('<form className'));
  });
  it('the Privacy & Terms page has the same sections in three languages, with the required points', () => {
    const shape = (l) => makeT(l)('privacy.sections').map(([, items]) => items.length);
    expect(shape('pt')).toEqual(shape('en'));
    expect(shape('es')).toEqual(shape('en'));
    for (const l of ['en', 'pt', 'es']) {
      const all = JSON.stringify(makeT(l)('privacy.sections'));
      for (const must of ['Luana Santos', 'GitHub', '48', 'Anthropic', 'ElevenLabs', 'LGPD', 'NASA', 'Apache']) expect(all, `${l} ${must}`).toContain(must);
      expect(all, l).not.toMatch(/[\w.+-]+@[\w-]+\.\w/); // no e-mail address
    }
  });
  it('footer links to the page on every screen, and the route exists', () => {
    expect(src('../components/Shell.jsx')).toContain("go('/privacy')");
    expect(src('../pages/Briefing.jsx')).toContain("go('/privacy')");
    expect(src('../App.jsx')).toContain("'/privacy': Privacy");
  });
  it('no cookies and no analytics in the app', () => {
    const files = [];
    const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|html)$/.test(f) && !f.endsWith('.test.js')) files.push(p); });
    walk(fileURLToPath(new URL('..', import.meta.url)));
    files.push(fileURLToPath(new URL('../../index.html', import.meta.url)));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/document\.cookie|google-analytics|gtag\(|googletagmanager|plausible|matomo|segment\.io|mixpanel/i);
  });
});
