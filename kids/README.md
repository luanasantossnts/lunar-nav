<!-- AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md. -->
# Lunar Nav Kids

An animated, child-friendly version of Lunar Nav for ages 8–12, published at **kids.lunarnav.space**. It is a separate static site: it does not change or call the main app.

- **Lumi**, an original astronaut-robot drawn in SVG, explains why the Moon's south pole is special.
- **Mission 1 — Find the sunniest spot:** days of sunshine in July 2030 at Shackleton, IM-2 and Malapert. The Sun moves along the real skyline.
- **Mission 2 — When can we call home?:** Earth rocks up and down (libration) and hides behind the terrain. A time slider shows when Earth is in view and a NASA Deep Space Network antenna sees the Moon.
- **Mission 3 — Charge for the long night:** a battery drains through the longest night. A half-size battery runs out.
- **Quiz and certificate:** a five-question quiz; 5 of 5 opens a printable "Junior Lunar Navigator: Cadet" certificate (no name asked).
- **Three phases**, shown as planets on the home screen, each with 0–3 stars per mission. A phase opens when the one before is done, and "Play anyway" never blocks anyone:
  - **Phase 1 · Cadet:** missions 1–3 above.
  - **Phase 2 · Explorer:**
    - *The landing slipped!*: Mons Mouton, 1 vs 11 July 2030; 0 h vs about 10 days of light before the first night.
    - *Hit the target*: a landing game on the real 121-point Shackleton grid, playable with the keyboard or by touch.
    - *Moon seasons*: sunny days per month in 2030.
  - **Phase 3 · Commander:**
    - *Ice hunt*: permanent shadow explained with NASA PGDA's 20 %, on the real Malapert grid.
    - *Time travel: Apollo 11*: Earth 60–72° high vs near the horizon at Shackleton.
    - *Final mission: your plan*: site × date × battery, three stars with their reasons.
  - Each phase has its own certificate (Cadet, Explorer, Commander).
- **Languages:** English (first visit), Spanish and Portuguese. `?lang=en|es|pt` works as in the main app.

## Data

The numbers are the main Lunar Nav API's own results for the default scenario: 30 days from 1 July 2030, terrain horizon, disc centre. They come from NASA/JPL Horizons, NASA LOLA and the NASA DSN station list. The export rounds them for children (days, halves, "at least"):

```bash
kids/scripts/export-data      # Docker, no network, read-only: writes kids/src/data/kids-data.json
```

The export reads the API's cache only, from a temporary copy, so the main cache is never written. It checks every total against the API before writing. At run time the site makes no network requests: everything is in the static build.

## Privacy and rules

- **No data from children:** no AI, chat, microphone, forms, cookies, analytics or outside resources. The fonts (Nunito for text, Baloo 2 for titles) and the drawings are served by the site.
- **localStorage:** the language (`lunarnav.lang`) and the progress (`lunarnav.kids.progress`: stars per mission and whether the quiz was passed — nothing personal, only on this device). An "Erase progress" button clears it.
- **Images:** no NASA or Space Apps logos, no photos, video or audio of people, no AI-generated images. Only SVG and CSS made for this site.
- **Tests:** `src/kids.test.js` checks these rules on the source.

## Develop, test, build

```bash
cd kids
npm install
npm run dev            # http://localhost:5173
npm test               # vitest: data = API export, keys in 3 languages, privacy rules
npm run build          # → kids/dist
node scripts/ui-check.cjs <url> <out> --shots   # Playwright + axe: 6 screens × 3 languages × 3 sizes
```

To deploy, see [deploy/kids/DEPLOY-KIDS.md](../deploy/kids/DEPLOY-KIDS.md).

Third-party software: see [THIRD_PARTY.md](THIRD_PARTY.md).
