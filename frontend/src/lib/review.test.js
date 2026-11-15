// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeT } from './i18n.js';
import { aiLines } from './aiStatus.js';
import { placeLabels } from '../components/PolarMap.jsx';
import { seqColor } from '../pages/Compare.jsx';
import { REPORT_SOURCES } from '../pages/Report.jsx';


describe('Methodology §5: Claude only, ElevenLabs voice', () => {
  it('states the analyst and the voice services in each language, with no other AI provider', () => {
    const en = aiLines(makeT('en'), { providers: { claude: true }, voice: { tts: false, stt: false } });
    expect(en[0]).toMatch(/^Analyst: Claude \(Anthropic\)\./);
    expect(en[1]).toBe("Read aloud uses ElevenLabs (AI voice; labelled); if unavailable, the browser's built-in speech.");
    expect(en[2]).toBe('Speech input uses ElevenLabs speech-to-text.');
    expect(en).toContain('Code written with AI assistance.');
    for (const l of ['en', 'pt', 'es']) expect(aiLines(makeT(l), null).join(' '), l).not.toMatch(/GPT|Llama|OpenAI|Whisper/);
    expect(aiLines(makeT('pt'), null)[0]).toMatch(/^Analista: Claude \(Anthropic\)/);
    expect(aiLines(makeT('es'), null)[0]).toMatch(/^Analista: Claude \(Anthropic\)/);
  });
});

describe('no unsourced "~100 m" figure', () => {
  it('locales use the sourced wording instead', () => {
    for (const l of ['en', 'pt', 'es']) {
      const raw = readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8');
      expect(raw, l).not.toMatch(/~100/);
    }
    expect(makeT('en')('method.limits')[1]).toMatch(/published coordinates are approximate, and real landings can miss their target by hundreds of metres/);
    expect(makeT('en')('report.assumptionsText')).toMatch(/hundreds of metres/);
  });
});

describe('Methodology §6 sources', () => {
  const src = readFileSync(new URL('../pages/Methodology.jsx', import.meta.url), 'utf8');
  it('lists the sources actually used, and not the unused DEM mosaic (PGDA 81)', () => {
    expect(src).not.toMatch(/products\/81|DEM Mosaic/);
    for (const s of ['ldem_80s_40m', 'ldem_75s_60m', 'products/69', 'Mazarico', '810-005/301/301P', 'moonbase-environment']) expect(src).toContain(s);
  });
});

describe('visual review helpers', () => {
  it('sensitivity colours use an absolute 0–100 % scale', () => {
    expect(seqColor(0)).toBe('color-mix(in srgb, var(--seq1) 0%, var(--seq0))');
    expect(seqColor(0.5)).toBe('color-mix(in srgb, var(--seq1) 100%, var(--seq0))');
    expect(seqColor(1)).toBe('color-mix(in srgb, var(--seq2) 100%, var(--seq1))');
    expect(seqColor(1.4)).toBe(seqColor(1));
  });
  it('polar map labels never overlap each other or fixed labels', () => {
    const items = [{ id: 'a', x: 300, y: 300, text: 'A · Shackleton rim' }, { id: 'b', x: 349, y: 213, text: 'B · IM-2 Athena' }, { id: 'm', x: 285, y: 229, text: 'Malapert Mountain' }, { id: 'i', x: 287, y: 66, text: 'IM-1 Odysseus' }];
    const fixed = [{ x: 304, y: 330, w: 30, h: 13 }];
    const pos = placeLabels(items, fixed);
    const box = (it) => { const p = pos[it.id]; const w = it.text.length * 7.2; return { x: p.anchor === 'start' ? p.x : p.x - w, y: p.y - 13, w, h: 13 }; };
    const boxes = items.map(box);
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `${items[i].id}/${items[j].id}`).toBe(false);
  });
  it('report footer names every data source', () => {
    expect(REPORT_SOURCES).toBe('JPL Horizons (DE441) · NASA LOLA · NASA PGDA · DSN 810-005');
  });
});

describe('small round: footer credit and SVS 5127', () => {
  it('the footer credit is the exact text in each language', () => {
    expect(makeT('en')('app.credit')).toBe('Built for the 2026 NASA Space Apps Challenge · Lunar Landing Site Navigator · Team Lumi Lunar · Independent project, not endorsed by NASA');
    expect(makeT('es')('app.credit')).toBe('Creado para el NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator · Equipo Lumi Lunar · Proyecto independiente, no respaldado por la NASA');
    expect(makeT('pt')('app.credit')).toBe('Feito para o NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator · Equipe Lumi Lunar · Projeto independente, não endossado pela NASA');
  });
  it('the app footer and the printed report both show it', () => {
    const shell = readFileSync(new URL('../components/Shell.jsx', import.meta.url), 'utf8');
    const report = readFileSync(new URL('../pages/Report.jsx', import.meta.url), 'utf8');
    expect(shell).toMatch(/t\('app\.credit'\)/);
    expect(report.match(/t\('app\.credit'\)/g).length).toBe(2); // printed footer + Markdown export
  });
  it('SVS 5127 is cited in Methodology §6 and REFERENCES.md', () => {
    expect(readFileSync(new URL('../pages/Methodology.jsx', import.meta.url), 'utf8')).toContain('https://svs.gsfc.nasa.gov/5127/');
    expect(readFileSync(new URL('../../../REFERENCES.md', import.meta.url), 'utf8')).toContain('SVS 5127');
  });
});

describe('3D opening view (camera3d)', async () => {
  const { initialView, viewFits, sceneHeight } = await import('./camera3d.js');
  // Synthetic tile: 20 km, gentle bowl + a deep crater to the north-west of the site.
  const n = 129; const ext = 20000; const z = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = (c / (n - 1) - 0.5) * ext; const y = (0.5 - r / (n - 1)) * ext;
    z[r * n + c] = 0.00002 * (x * x + y * y) - 3000 * Math.exp(-((x + 6000) ** 2 + (y - 6000) ** 2) / (2 * 2500 ** 2));
  }
  let min = Infinity; for (const v of z) min = Math.min(min, v);
  const hm = { z, n, ext, min, exag: 2 };
  const target = [0, sceneHeight(hm, 0, 0), 0];
  it('opens at 40–45°, with every border ray landing on the tile', () => {
    for (const aspect of [2.13, 0.69]) {
      const v = initialView(hm, target, { aspect });
      expect(v.fits).toBe(true);
      expect([40, 45]).toContain(v.el);
      expect(viewFits(hm, target, v.az, v.el, v.d, 45, aspect, (ext / 2) * 0.93 * 0.98)).toBe(true);
    }
  });
  it('a camera far away and low shows the tile edge (rejected)', () => {
    expect(viewFits(hm, target, 135, 20, ext * 0.6, 45, 2.13, (ext / 2) * 0.93 * 0.98)).toBe(false);
  });
});

describe('degrees: two decimals', async () => {
  const { deg, degRange, round2 } = await import('./format.js');
  it('formats and rounds angles to two decimals', () => {
    expect(deg(1.528)).toBe('1.53°');
    expect(degRange(0.5812, -1.2)).toBe('0.58° – −1.20°');
    expect(round2({ min: 59.554, max: 71.661, mean: 65.4341 })).toEqual({ min: 59.55, max: 71.66, mean: 65.43 });
  });
  it('the sky view shows the skyline azimuth with two decimals', () => {
    const src = readFileSync(new URL('../pages/SkyView.jsx', import.meta.url), 'utf8');
    expect(src).toContain('fixed(sNow.az, 2)');
    expect(src).not.toMatch(/\.(az|el)\.toFixed\([013]\)/);
  });
});

describe('minus sign U+2212 for negatives', async () => {
  const { fixed, minus, deg, signed } = await import('./format.js');
  it('formats negative numbers with a true minus, never a hyphen', () => {
    expect(fixed(-3.4, 2)).toBe('−3.40');
    expect(fixed(-2)).toBe('−2');
    expect(fixed(-0.001, 2)).toBe('0.00'); // no "−0.00"
    expect(fixed(4, 0)).toBe('4');
    expect(deg(-1.2)).toBe('−1.20°');
    expect(signed(-1.01, 2, 'kWh')).toMatch(/^−/);
  });
  it('fixes hyphen-minus in free text but leaves dates and identifiers alone', () => {
    expect(minus('Δ -10.7 points, range -2.5 to 3')).toBe('Δ −10.7 points, range −2.5 to 3');
    expect(minus('2030-07-01 · DSS-14 · IM-2 · 810-005')).toBe('2030-07-01 · DSS-14 · IM-2 · 810-005');
  });
  it('sky view, panorama and elevation chart use the formatter for numbers', () => {
    for (const f of ['../pages/SkyView.jsx', '../components/SkyPanorama.jsx', '../components/ElevationChart.jsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).toContain('fixed(');
      expect(src, f).not.toMatch(/\.(el|az|sky)\.toFixed\(/);
    }
  });
});

describe('brand', () => {
  it('Briefing has the logo lockup above the title, and the top bar mark is 28 px (≈24 px visible)', () => {
    const brief = readFileSync(new URL('../pages/Briefing.jsx', import.meta.url), 'utf8');
    expect(brief.indexOf('<Logo size={68} />')).toBeGreaterThan(-1);
    expect(brief.indexOf('<Logo size={68} />')).toBeLessThan(brief.indexOf("t('brief.title')"));
    expect(brief).toContain("t('app.by')");
    expect(readFileSync(new URL('../components/Shell.jsx', import.meta.url), 'utf8')).toContain('<Logo size={28} />');
  });
});

describe('field alignment', () => {
  it('the ISO date sits on the label line (no extra line under the date pickers)', () => {
    const bar = readFileSync(new URL('../components/ScenarioBar.jsx', import.meta.url), 'utf8');
    const cmp = readFileSync(new URL('../pages/Compare.jsx', import.meta.url), 'utf8');
    for (const src of [bar, cmp]) {
      expect(src).toContain('label-hint');
      expect(src).not.toMatch(/type="date"[^\n]*\/>\s*\n\s*<span className="font-mono text-\[11px\]/);
    }
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.field \{[^}]*height: 36px/);
    expect(css).toMatch(/\.seg > button \{[^}]*height: 36px/);
    expect(css).toMatch(/\.label-row \{[^}]*height: 16px[^}]*white-space: nowrap/);
  });
});

describe('Briefing layout', () => {
  const brief = readFileSync(new URL('../pages/Briefing.jsx', import.meta.url), 'utf8');
  it('top bar on the Briefing has the tagline only (no mark, no name); other pages keep the logo', () => {
    const header = brief.slice(brief.indexOf('<header'), brief.indexOf('</header>'));
    expect(header).not.toMatch(/<Logo/);
    expect(header).not.toMatch(/app\.name/);
    expect(header).toContain("t('app.tagline')");
    expect(readFileSync(new URL('../components/Shell.jsx', import.meta.url), 'utf8')).toContain('<Logo size={28} />');
  });
  it('left column is top-aligned, and the big lockup keeps the visible site name', () => {
    expect(brief).toContain('justify-start');
    expect(brief).not.toMatch(/<section[^>]*justify-center/);
    const lockup = brief.slice(brief.indexOf('Brand lockup'), brief.indexOf("t('brief.title')"));
    expect(lockup).not.toContain('aria-hidden="true">');
    expect(lockup).toContain("t('app.name')");
  });
  it('SVS gallery: 1 / 2 / 3 columns', () => {
    expect(readFileSync(new URL('../components/SvsContext.jsx', import.meta.url), 'utf8')).toContain('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
  });
});

describe('Briefing sticky column', () => {
  const brief = readFileSync(new URL('../pages/Briefing.jsx', import.meta.url), 'utf8');
  it('sticks only from 1024 px and only when the content fits below the bar', () => {
    expect(brief).toContain("matchMedia('(min-width: 1024px)')");
    expect(brief).toMatch(/need <= window\.innerHeight - top/);
    expect(brief).toMatch(/position: 'sticky', top: stick\.top/);
    expect(brief).toMatch(/<header ref=\{headerRef\}[^>]*lg:sticky lg:top-0/);
  });
  it('Sun and Earth on separate lines, label and value never split', () => {
    expect(brief.match(/className="block whitespace-nowrap"/g).length).toBe(2);
  });
});
