// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Lunar Nav Kids — browser checks with Playwright + axe-core (run in a container that has both):
 *   node ui-check.cjs <base-url> <out-dir> [--shots]
 * For every screen × language (en, es, pt) × size (phone, tablet, desktop): axe (WCAG 2.1 A/AA +
 * best practices), horizontal overflow, console errors and outside requests. With --shots it also
 * saves screenshots of each mission. Writes <out-dir>/ui-report.json and prints a summary.
 */
const { chromium } = require('/opt/pw/node_modules/playwright');
const { AxeBuilder } = require('/opt/pw/node_modules/@axe-core/playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:5198/';
const OUT = process.argv[3] || '.';
const SHOTS = process.argv.includes('--shots');
const ROUTES = ['/', '/sun', '/call', '/battery', '/quiz', '/certificate'];
const SIZES = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };
const origin = new URL(BASE).origin;

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const lang of ['en', 'es', 'pt']) {
    for (const [size, [w, h]] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
      await ctx.addInitScript((l) => { try { localStorage.setItem('lunarnav.lang', JSON.stringify(l)); } catch (e) { /* blocked */ } }, lang);
      const page = await ctx.newPage();
      const errors = []; const outside = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u); });
      for (const route of ROUTES) {
        errors.length = 0; outside.length = 0;
        await page.goto(`${BASE}#${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        // Move each mission's time a little, so the checks also see a "later" state.
        if (route === '/sun' || route === '/call') await page.locator('input[type=range]').first().fill('120');
        if (route === '/battery') await page.locator('input[type=range]').first().fill('20');
        if (route === '/quiz') await page.locator('.choice').first().click();
        await page.waitForTimeout(250);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        const layout = await page.evaluate(() => ({
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          lang: document.documentElement.lang,
          smallTargets: [...document.querySelectorAll('button, a.btn, input[type=range]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).map((e) => e.textContent.trim().slice(0, 20)),
          storage: Object.keys(localStorage),
          cookies: document.cookie,
        }));
        report.push({ lang, size, route, violations: axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })), ...layout, errors: [...errors], outside: [...outside] });
        if (SHOTS && (size !== 'tablet' || lang === 'en')) await page.screenshot({ path: `${OUT}/${lang}-${size}${route === '/' ? '-home' : route.replace('/', '-')}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
  // Certificate lock: wrong answer → locked (no print button); 5 of 5 → unlocked (print button).
  const lock = {};
  for (const [lang, picks] of [['en', [0, 1, 1, 1, 0]], ['es', [0, 1, 1, 1, 0]], ['pt', [0, 1, 1, 1, 0]], ['en-one-wrong', [0, 1, 1, 1, 1]]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
    await ctx.addInitScript((l) => { try { localStorage.setItem('lunarnav.lang', JSON.stringify(l)); } catch (e) { /* blocked */ } }, lang.slice(0, 2));
    const page = await ctx.newPage();
    await page.goto(`${BASE}#/quiz`, { waitUntil: 'networkidle' });
    const before = await page.locator('.certificate.locked').count();
    for (const i of picks) {
      await page.locator('.choice').nth(i).click();
      await page.locator('.explain + p .btn').click();
    }
    await page.waitForTimeout(300);
    lock[lang] = { lockedBefore: before === 1, lockedAfter: await page.locator('.certificate.locked').count() === 1, printButton: await page.locator('#certificate .btn').count() };
    if (SHOTS && (lang === 'en' || lang === 'en-one-wrong')) await page.screenshot({ path: `${OUT}/${lang}-desktop-certificate-${lang === 'en' ? 'unlocked' : 'locked'}.png`, fullPage: true });
    await ctx.close();
  }
  console.log('certificate lock:', JSON.stringify(lock));
  await browser.close();
  fs.writeFileSync(`${OUT}/ui-report.json`, JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.violations.length || r.overflowX > 0 || r.errors.length || r.outside.length || r.smallTargets.length || r.cookies || r.storage.some((k) => k !== 'lunarnav.lang'));
  console.log(`pages checked: ${report.length} · axe violations: ${report.reduce((a, r) => a + r.violations.length, 0)} · with horizontal scroll: ${report.filter((r) => r.overflowX > 0).length} · console errors: ${report.reduce((a, r) => a + r.errors.length, 0)} · outside requests: ${report.reduce((a, r) => a + r.outside.length, 0)} · targets < 44 px: ${report.reduce((a, r) => a + r.smallTargets.length, 0)}`);
  for (const r of bad.slice(0, 20)) console.log(JSON.stringify(r).slice(0, 400));
})();
