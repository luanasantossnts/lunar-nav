// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import DATA from './data/kids-data.json';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import { batteryLevel, callReason, certificateUnlocked, runsOut, sample, sampleCount, skylineAt } from './lib/data.js';
import { initialLang, kidNumber, makeT, urlLang, withoutLangParam } from './lib/lang.js';

const LOCALES = { en, es, pt };
const SRC = new URL('.', import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const CODE = files(SRC).filter((f) => /\.(jsx?|css)$/.test(f) && !f.endsWith('.test.js'));
const half = (v, lb) => (lb ? Math.floor(v * 2) / 2 : Math.round(v * 2) / 2);

describe('kids-data.json matches the API export (default scenario, terrain)', () => {
  it('three sites, the scenario and the sources are recorded', () => {
    expect(Object.keys(DATA.sites)).toEqual(['shackleton_ridge', 'im2_athena', 'malapert_m1']);
    expect(DATA.about.scenario).toMatch(/1 July 2030.*terrain/);
    expect(DATA.about.sources.join(' ')).toMatch(/Horizons/);
    expect(DATA.about.sources.join(' ')).toMatch(/LOLA/);
    expect(DATA.about.sources.join(' ')).toMatch(/Deep Space Network/);
    expect(DATA.about.period.hours).toBe(720);
  });
  it('every child-friendly number is the API value, rounded by the stated rule', () => {
    for (const [id, s] of Object.entries(DATA.sites)) {
      const r = s.raw; const k = s.kids;
      expect(k.sun_days, id).toBe(Math.round(r.sun_hours / 24));
      expect(k.sun_percent, id).toBe(Math.round(100 * r.sun_fraction));
      expect(k.call_days, id).toBe(Math.round(r.contact_hours / 24));
      expect(k.longest_no_call_days, id).toBe(half(r.longest_no_contact_h / 24, r.longest_no_contact_lower_bound));
      if (r.longest_night_h >= 24) expect(k.night_days, id).toBe(half(r.longest_night_h / 24, r.longest_night_lower_bound));
      else expect(k.night_hours, id).toBe(Math.round(r.longest_night_h));
      if (r.battery_kwh >= 1) expect(k.battery_kwh, id).toBe(Math.round(r.battery_kwh));
      else expect(k.battery_under_1_kwh, id).toBe(true);
      // the API's battery rule: survival load × longest night ÷ depth of discharge
      const pm = DATA.about.power_model;
      expect(r.battery_kwh, id).toBeCloseTo((pm.survival_w * r.longest_night_h) / pm.dod / 1000, 2);
    }
  });
  it('the spans used by the animations add up to the API totals', () => {
    const sum = (sp) => sp.reduce((a, [x, y]) => a + (y - x) * 24, 0);
    for (const [id, s] of Object.entries(DATA.sites)) {
      expect(Math.abs(sum(s.spans.sun) - s.raw.sun_hours), id).toBeLessThan(0.5);
      expect(Math.abs(sum(s.spans.call) - s.raw.contact_hours), id).toBeLessThan(0.5);
    }
  });
  it('Shackleton tip: 300 m can turn 30 sunny days into the API P10–P90 range (48–73 % → 14 to 22 days)', () => {
    const s = DATA.sites.shackleton_ridge;
    const days = DATA.about.period.hours / 24;
    expect(s.kids.sun_days_p10_300m).toBe(Math.round(s.raw.sun_p10_300m * days));
    expect(s.kids.sun_days_p90_300m).toBe(Math.round(s.raw.sun_p90_300m * days));
    expect(Math.round(100 * s.raw.sun_p10_300m)).toBe(48);
    expect(Math.round(100 * s.raw.sun_p90_300m)).toBe(73);
    expect([s.kids.sun_days_p10_300m, s.kids.sun_days_p90_300m]).toEqual([14, 22]);
    expect(s.raw.spread_radius_m).toBe(300);
    for (const l of [en, es, pt]) expect(l.m1.tip).toMatch(/300\u00A0m/);
  });
  it('phone batteries: battery Wh ÷ 15 Wh (nearest 100 when large); IM-2 ≈ 1,800 phones, about 180 kg', () => {
    const wh = DATA.about.phone_battery_wh;
    expect(wh).toBe(15);
    for (const [id, s] of Object.entries(DATA.sites)) {
      const n = s.raw.battery_wh / wh;
      expect(s.kids.phone_batteries, id).toBe(n >= 100 ? Math.round(n / 100) * 100 : Math.round(n));
      expect(s.raw.battery_wh, id).toBeCloseTo(1000 * s.raw.battery_kwh, 0);
    }
    expect(DATA.sites.im2_athena.kids.phone_batteries).toBe(1800);
    expect(DATA.sites.im2_athena.kids.battery_kg).toBe(180);
  });
  it('Earth in the sky: spans add up to the API hours; longest hiding is the API value rounded to a half', () => {
    const sum = (sp) => sp.reduce((a, [x, y]) => a + (y - x) * 24, 0);
    for (const [id, s] of Object.entries(DATA.sites)) {
      expect(Math.abs(sum(s.spans.earth) - s.raw.earth_hours), id).toBeLessThan(0.5);
      expect(s.kids.earth_days, id).toBe(Math.round(s.raw.earth_hours / 24));
      expect(s.kids.longest_no_earth_days, id).toBe(half(s.raw.longest_no_earth_h / 24, s.raw.longest_no_earth_lower_bound));
    }
    expect(DATA.sites.shackleton_ridge.kids.earth_days).toBe(13);
    expect(DATA.sites.shackleton_ridge.kids.longest_no_earth_days).toBe(14.5);
  });
  it('sunniest order follows the API fractions; samples and skyline have the expected size', () => {
    const order = Object.keys(DATA.sites).sort((a, b) => DATA.sites[b].raw.sun_fraction - DATA.sites[a].raw.sun_fraction);
    expect(DATA.sunniest).toEqual(order);
    for (const id of Object.keys(DATA.sites)) {
      expect(sampleCount(id)).toBe(241);
      expect(DATA.sites[id].skyline).toHaveLength(180);
    }
  });
  it('a sample flagged "can call" always has Earth up and an antenna that sees the Moon', () => {
    for (const id of Object.keys(DATA.sites)) {
      for (let i = 0; i < sampleCount(id); i++) {
        const s = sample(id, i);
        if (s.canCall) expect(s.earthUp && s.dsn, `${id} ${i}`).toBe(true);
        expect(['ok', 'antennas', 'mountains', 'below']).toContain(callReason(id, s));
      }
    }
    expect(skylineAt('shackleton_ridge', 360)).toBeCloseTo(skylineAt('shackleton_ridge', 0), 6);
  });
  it('battery picture: right size ends the night at 20 %, half size runs out halfway', () => {
    expect(batteryLevel(0, 15)).toBe(100);
    expect(batteryLevel(15, 15)).toBeCloseTo(20, 6);
    expect(batteryLevel(7.5, 15, 0.5)).toBeCloseTo(20, 6);
    expect(runsOut(7.5, 15, 0.5)).toBe(true);
    expect(runsOut(15, 15, 1)).toBe(false);
  });
});

describe('certificate: only after 5 of 5 right answers', () => {
  it('stays locked until the quiz is finished with every answer right', () => {
    expect(certificateUnlocked(5, 5, true)).toBe(true);
    expect(certificateUnlocked(4, 5, true)).toBe(false);
    expect(certificateUnlocked(0, 5, true)).toBe(false);
    expect(certificateUnlocked(5, 5, false)).toBe(false); // not finished yet
  });
  it('the print button exists only in the unlocked certificate, and a locked card is not printed', () => {
    const src = readFileSync(new URL('./components/Certificate.jsx', import.meta.url), 'utf8');
    const lockedPart = src.slice(src.indexOf(') : ('), src.indexOf('</section>', src.indexOf(') : (')));
    expect(src).toMatch(/\{unlocked \? \(/);
    expect(lockedPart).not.toMatch(/window\.print|onClick=\{print\}/);
    expect(src).toMatch(/onClick=\{print\}/);
    expect(readFileSync(new URL('./styles.css', import.meta.url), 'utf8')).toMatch(/@media print[\s\S]*\.certificate\.locked \{ display: none !important; \}/);
  });
  it('the quiz answers are the same in every language (the UI check answers 0, 1, 1, 1, 0)', () => {
    for (const d of [en, es, pt]) expect(d.quiz.questions.map((q) => q.answer)).toEqual([0, 1, 1, 1, 0]);
  });
});

describe('texts in English, Spanish and Portuguese', () => {
  const walk = (o, p = '') => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => walk(v, p ? `${p}.${k}` : k)) : [[p, o]]);
  it('the same keys and the same {placeholders} in every language', () => {
    const ref = Object.fromEntries(walk(en));
    for (const [l, d] of Object.entries(LOCALES)) {
      const m = Object.fromEntries(walk(d));
      expect(Object.keys(m).sort(), l).toEqual(Object.keys(ref).sort());
      for (const [k, v] of Object.entries(ref)) {
        if (typeof v === 'string') expect((m[k].match(/\{\w+\}/g) || []).sort(), `${l} ${k}`).toEqual((v.match(/\{\w+\}/g) || []).sort());
        else expect(m[k], `${l} ${k}`).toEqual(v); // quiz answer indexes
      }
    }
  });
  it('every t(\'…\') key used in the code exists', () => {
    const keys = new Set();
    for (const f of CODE) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
    const ids = Object.keys(DATA.sites);
    for (const f of CODE) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/t\(`sites\.\$\{\w+\}\.(\w+)`/g)) ids.forEach((id) => keys.add(`sites.${id}.${m[1]}`));
      if (/t\(`m2\.badge\.\$\{reason\}`/.test(src)) ['ok', 'antennas', 'mountains', 'below'].forEach((r) => keys.add(`m2.badge.${r}`));
      if (/t\(`\$\{k\}\.(title|teaser)`/.test(src)) ['m1', 'm2', 'm3'].forEach((x) => { keys.add(`${x}.title`); keys.add(`${x}.teaser`); });
      if (/t\(`m2\.station\.\$\{a\}`/.test(src)) ['goldstone', 'madrid', 'canberra'].forEach((a) => keys.add(`m2.station.${a}`));
    }
    for (const [l, d] of Object.entries(LOCALES)) {
      const t = makeT(l);
      for (const k of keys) expect(typeof t(k) === 'string' || Array.isArray(t(k)), `${l} ${k}`).toBe(true);
      for (const k of keys) expect(t(k), `${l} ${k}`).not.toBe(k);
      expect(d.quiz.questions).toHaveLength(5);
    }
  });
  it('the footer says what the brief asks for', () => {
    expect(en.footer.privacy).toBe('No names, no accounts. Progress stays only on this device.');
    expect(pt.footer.privacy).toBe('Sem nomes, sem contas. O progresso fica só neste aparelho.');
    expect(es.footer.privacy).toBe('Sin nombres, sin cuentas. El progreso se queda solo en este dispositivo.');
    // Nothing may claim that progress is not saved: stars and a 5 of 5 are kept on this device.
    for (const d of [en, es, pt]) expect(JSON.stringify(d)).not.toMatch(/nothing (is )?saved|not saved|nada salvo|não é salvo|no se guarda/i);
    expect(en.footer.notEndorsed).toBe('Independent project, not endorsed by NASA');
    expect(en.footer.data).toBe('Built on NASA/JPL Horizons and NASA LOLA data');
    expect(en.footer.grownups).toBe('For grown-ups: lunarnav.space');
  });
});

describe('language: English first, saved choice, ?lang= wins', () => {
  it('works like the main app', () => {
    expect(initialLang(null, null)).toBe('en');
    expect(initialLang('pt', null)).toBe('pt');
    expect(initialLang('pt', 'es')).toBe('es');
    expect(urlLang({ search: '?lang=PT', hash: '' })).toBe('pt');
    expect(urlLang({ search: '', hash: '#/sun?lang=es' })).toBe('es');
    expect(urlLang({ search: '?lang=fr', hash: '' })).toBe(null);
    expect(withoutLangParam('https://kids.lunarnav.space/?lang=pt#/call')).toBe('https://kids.lunarnav.space/#/call');
  });
  it('numbers for children: halves as ½, decimal comma in es/pt, true minus sign', () => {
    expect(kidNumber(14.5, 'en')).toBe('14½');
    expect(kidNumber(0.5, 'pt')).toBe('½');
    expect(kidNumber(27, 'es')).toBe('27');
    expect(kidNumber(-7, 'en')).toBe('−7');
    expect(kidNumber(2.3, 'pt')).toBe('2,3');
  });
});

describe('children\'s privacy (LGPD art. 14) and Space Apps rules', () => {
  const all = CODE.map((f) => [f.replace(SRC, ''), readFileSync(f, 'utf8')]);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  it('no network, chat, microphone, forms, cookies or analytics', () => {
    for (const [f, s] of all) {
      expect(s, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|getUserMedia|mediaDevices|SpeechRecognition|document\.cookie|<form|analytics|gtag|navigator\.geolocation/);
    }
  });
  it('no external resources: the only outside address is the link for grown-ups', () => {
    for (const [f, s] of all) {
      const urls = [...s.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
      expect(urls.every((u) => u === 'https://lunarnav.space/'), `${f}: ${urls}`).toBe(true);
    }
    expect(html).not.toMatch(/https?:\/\//);
  });
  it('browser storage holds only the language and the progress', () => {
    const uses = all.filter(([, s]) => /localStorage|sessionStorage|indexedDB/.test(s)).map(([f]) => f);
    expect(uses.sort()).toEqual(['lib/lang.js', 'lib/progress.js']);
    expect(all.find(([f]) => f === 'lib/lang.js')[1]).toMatch(/STORAGE_KEY = 'lunarnav\.lang'/);
    expect(all.find(([f]) => f === 'lib/progress.js')[1]).toMatch(/PROGRESS_KEY = 'lunarnav\.kids\.progress'/);
  });
  it('no images or media files: only SVG and CSS drawn for this project', () => {
    const media = files(SRC).concat(files(new URL('../public', import.meta.url).pathname)).filter((f) => /\.(png|jpe?g|gif|webp|mp3|mp4|webm|wav|ogg)$/i.test(f));
    expect(media).toEqual([]);
  });
  it('every code file starts with the AI-assisted note', () => {
    for (const [f, s] of all) expect(s.slice(0, 120), f).toMatch(/AI-assisted: written with Claude \(Anthropic\)/);
    expect(html).toMatch(/AI-assisted: written with Claude \(Anthropic\)/);
  });
});
