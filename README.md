# Lunar Nav

**Landing-site navigator for the lunar south pole.** Lunar Nav compares landing sites and dates by where the Sun and Earth sit against the local horizon, for how long, and what a schedule change does to both. Built for the NASA Space Apps Challenge 2026, challenge *Lunar Landing Site Navigator*.

Team **Lumi Lunar** · Luana Santos — individual project · Licence: Apache-2.0 · Languages: English, Español, Português

> Lunar Nav is an independent project. It is not affiliated with or endorsed by NASA. It uses NASA and JPL public data and services, cited in [REFERENCES.md](REFERENCES.md).

---

## What it does

| Screen | What you get |
|---|---|
| **Briefing** (`#/`) | The problem in one sentence, live numbers for the default pair of sites, a 60-second tour. |
| **Explorer** (`#/planner`) | Polar map of catalogue sites, per-site readout (sunlight %, Earth in view %, both, longest dark period, longest gap without Earth, next sunset / Earthset, panel factor), visibility timeline, elevation chart. Geometric or terrain (LOLA) horizon, antenna elevation margin. |
| **Compare** (`#/compare`) | Original landing vs. delayed landing for both sites; delay deltas; search for landing dates that meet constraints; sensitivity map (how the result changes a few hundred metres away). |
| **Sky view** (`#/sky`) | 360° horizon panorama with Sun and Earth tracks and terrain skyline; 3D terrain lit from the Sun at the cursor; present mode; playback. |
| **Charts** (`#/charts`) | Six read-only charts of the same data, each with a one-line reading, a legend, a screen-reader summary and a data table: sites side by side (with disc range and ±300 m P10–P90), 2030 month by month, our model vs NASA PGDA, battery needed by site, what a delay changes, and the ±300 m sunlight histogram at site A. Findings: Malapert gets 0 % sunlight from January to June 2030 (and again in December); within 300 m its battery need ranges from 1.7 kWh to at least 108 kWh; at IM-2 the date decides — landing on 1 July 2030 means arriving in darkness (0 h of daylight before the first night), landing 10 days later gives 250.8 h. |
| **Analyst** (`#/analyst`) | Ask in plain language (typed, or spoken with ElevenLabs speech-to-text). Claude (Anthropic) answers **only** from Lunar Nav tool results, with citations; every tool call is shown. The answer's summary can be read aloud (ElevenLabs AI voice, labelled; the browser's own voice if unavailable). Repeated questions are answered from a cache, marked "cached answer". |
| **Report** (`#/report`) | Printable/PDF scenario report; JSON, CSV and Markdown downloads with full provenance. |
| **Methodology** (`#/methodology`) | Premises, validation status, provenance of the current result, use of AI, sources. |

Every number carries provenance: data source, method version, site source, Horizons parameters, step, horizon mode (geometric / terrain / *terrain unavailable for this site*), margins, cache state.

The horizon defaults to **Terrain (LOLA)** wherever a NASA LOLA mask exists; sites without one (Chandrayaan-3) use the smooth sphere and say *terrain unavailable for this site*. The user's choice (top bar, or `mode=` in the URL) always wins.

## Architecture

```
frontend/   React 18 + Vite + Tailwind + three.js (static build → frontend/dist)
api/        PHP 8.2, no framework. JSON API under /api
  src/Horizons   JPL Horizons client + CSV parser (cached forever)
  src/Metrics    interval metrics, scenarios, delay, date search, sensitivity
  src/Terrain    horizon masks, terrain grid, heightmap assets
  src/Geo        ENU frames, direction transfer between nearby points
  src/Agent      tool-use analyst (Claude: answer cache, prompt caching, limits)
  src/Voice      ElevenLabs text-to-speech (cached MP3) and speech-to-text
  src/Usage      daily usage counters and global limits (private)
  bin/           validate.php, warm-cache.php, warm-analyst.php, usage.php, MySQL cache table
  tests/         run.php (offline checks, no paid API calls)
preprocess/ Python: LOLA DEM → horizon masks, grid masks, heightmap, hillshade
```

Data flow: browser → `/api/metrics` → Horizons series for Sun (10) and Earth (399) from a lunar-surface observer (`CENTER='coord@301'`, geodetic site, `QUANTITIES=4`, `APPARENT=AIRLESS`) → metrics per interval with linear interpolation of horizon crossings → JSON with provenance.

### API

| Method & path | Parameters |
|---|---|
| `GET /api/health` | — (which AI/voice providers are configured) |
| `GET /api/sites` | — |
| `GET /api/terrain?site=` | terrain availability, mask, grid, heightmap meta |
| `GET /api/metrics` | `site` or `lat`,`lon`; `start` (ISO date or Unix s); `days` (1–60); `step` (min); `mode=geometric\|terrain`; `sun_margin`, `earth_margin` (°); `series=1` |
| `GET /api/ephemeris` | same as metrics, always with series |
| `POST /api/compare` | `{scenarios:[{site,start,days,label}], step, mode, …}` (1–4) |
| `GET /api/delay` | metrics params + `delay_days` (−60…60) |
| `GET /api/windows` | `site`, `from`, `to`, `duration_days`, `step_hours`, constraints `min_sun_fraction`, `min_earth_fraction`, `min_earth_hours_per_day`, `min_both_fraction`, `max_dark_hours` |
| `GET /api/sensitivity` | `site`, `start`, `days` (needs a terrain grid) |
| `GET /api/validation` | last `bin/validate.php` result |
| `POST /api/analyst` | `{question, lang, provider, level}` |
| `POST /api/tts`, `POST /api/stt` | voice |

## Run locally

Requirements: PHP 8.2+ with curl and json; Node 18+; (optional) Python 3.10+ for terrain.

```bash
# 1. front end
cd frontend
npm install
npm run build          # → frontend/dist
npm test               # 5 unit tests

# 2. API config
cd ../api
cp config.example.php config.php     # never commit config.php
php tests/run.php                    # offline checks (fake Claude/ElevenLabs, no paid calls)

# 3. serve both (from the project root)
cd ..
php -S localhost:8080 -t frontend/dist api/dev-router.php
# open http://localhost:8080
```

No PHP on your machine? Use Docker:

```bash
docker run --rm -it -p 8080:8080 -v "$PWD":/app -w /app php:8.3-cli \
  php -S 0.0.0.0:8080 -t frontend/dist api/dev-router.php
```

For front-end development with hot reload: run the PHP server on 8080 and `npm run dev` in `frontend/` (Vite proxies `/api` to 8080).

**Offline mode (testing only).** `LUNARNAV_FAKE_HORIZONS=1` replaces JPL Horizons with an analytic test double. Every screen then shows an orange *OFFLINE TEST DATA* banner and the provenance says `FAKE (offline test double)`. Never use it for results.

### Secrets

Put keys in `api/config.php` or environment variables (environment wins):

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | Claude analyst |
| `ANTHROPIC_MODEL` | optional: another Claude model (default `claude-opus-5-5`) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | read answers aloud (text-to-speech) and speech input (speech-to-text) |
| `IP_SALT` | secret for hashing client addresses for the hourly limits (if unset, one is created in a file outside the web root) |

For Docker, keep them in a file outside the project and pass it with `--env-file` (never commit it):

```bash
docker run --rm --env-file ~/lunar-dem/secrets.env -p 8090:8080 -v "$PWD":/app -w /app php:8.3-cli \
  php -S 0.0.0.0:8080 -t frontend/dist api/dev-router.php
```

Without keys the app still works; the Analyst says it is not available, and read-aloud uses the browser's built-in speech. Keys are only used server-side and are never sent to the browser.

## Validate against real Horizons (do this before submitting)

```bash
cd api
php bin/validate.php 2030-07-01 30     # writes data/validation.json, shown on Methodology
php bin/warm-cache.php 2030-07-01 30   # pre-fetches the default scenarios
```

`validate.php` runs: an Apollo 11 control (equatorial site: Sun about half the time, Earth always up); step convergence 60/10/1 minutes; terrain presence per site. Reference numbers from earlier manual runs (July 2030, geometric): Apollo 11 Sun 49.2 %, Earth 100 % at 59.6–71.7° elevation.

## Terrain (NASA LOLA)

1. Download a LOLA polar stereographic DEM (GeoTIFF) that **covers each site** — see REFERENCES.md (PGDA product 81 for 87.5°S and poleward; IM-2 at 84.8°S and Malapert at 86°S need a product reaching further north, e.g. a polar LDEM product from the LOLA PDS archive covering 80°S–90°S; PDS `.IMG` files with their `.LBL` label open in GDAL/rasterio).
2. Build site assets:

```bash
cd preprocess
pip install -r requirements.txt
pytest -q                                  # 5 tests on synthetic DEMs
python build_site_assets.py \
  --dem /path/to/your_lola_dem.tif \
  --sites ../api/data/sites.json \
  --out ../api/data/terrain \
  --product "<exact LOLA product name and version>" \
  --max-dist-km 150 --grid-n 7 --grid-spacing 250
```

Check `--units`/`--scale` against the product label (some DEMs store half-metres or kilometres). Sites outside the DEM are skipped and shown in the app as *terrain unavailable for this site*. The output records, per ray, how much of the ray the DEM covered, so a truncated horizon is never presented as complete.

## Deploy (shared hosting, Apache + PHP)

```
public_html/
  index.html, assets/, favicon.svg, …   ← contents of frontend/dist
  api/                                  ← the api/ folder (with .htaccess)
    config.php                          ← created on the server, not uploaded from git
    data/cache/                         ← writable by PHP
    data/terrain/                       ← output of preprocess
```

1. `npm run build` and upload `frontend/dist/*` to the web root.
2. Upload `api/` as `/api`. Create `api/config.php` on the server; make `api/data/cache` writable.
3. Turn on HTTPS. The `.htaccess` blocks `src/`, `bin/`, `tests/`, the cache, `config.php` and the dev router.
4. Run `php api/bin/validate.php` and `php api/bin/warm-cache.php` on the server (or upload `data/cache` and `data/validation.json` generated locally).
5. Optional MySQL cache: run `api/bin/create-cache-table.sql`, set `cache.driver = 'mysql'`.

Keep the site online until judging ends (January 2027). Use a neutral domain (no "nasa").

## Cost controls

The two paid services are Claude (Analyst) and ElevenLabs (voice). Both are limited so a public demo cannot run up a bill.

**Claude**
- *Answer cache.* An answer is stored for 90 days under a hash of the question (lower case, single spaces), language, mode (Technical/Learn), scenario on screen, earlier turns, method version and model. The same question is answered again without calling Claude and is marked "cached answer". No IP address or other personal data is part of the key.
- *Prompt caching.* The tool definitions and system prompt are identical on every request and are marked cacheable (`cache_control`), so repeated requests read them at a fraction of the input price; the tool loop also reuses its own prefix. If the API rejects the field, requests continue without it.
- *Limits* (in `api/config.php`, `ai.*`): answer length `max_tokens` 1200; at most 6 tool rounds per question; questions up to 500 characters; 15 questions per hour per client; 200 real Claude requests per day for all users (cached answers do not count). When a limit is reached the app shows a polite message in the user's language.
- *Model* (`ai.model`, or `ANTHROPIC_MODEL`). The default is `claude-opus-5-5`. Smaller models cost less per token (for example `claude-sonnet-5-5` or `claude-haiku-5-5`); check that answers still follow the citation and number rules before switching.

**ElevenLabs**
- *Audio cache.* Each spoken text is stored once as an MP3 (`api/data/cache/tts/`, named by a hash of text, voice, model and language) and served with a long browser cache; the same text is never synthesised twice.
- *Summary first.* "Listen to the summary" reads only the Conclusion and Trade-off (no tables, citations or assumptions), at most 900 characters; "Read full answer" reads up to 2 500.
- *Limits* (`voice.*`): read-aloud 20 per hour per client and 60 000 characters per day for all users (cached audio does not count) — beyond that the browser's own voice is used, with a short note; speech input up to 30 s and 2 MB per recording, 10 per hour per client, 60 per day. The transcript goes to the question box and is sent only when you press Run.

**Usage and warm-up**
- `php api/bin/usage.php [days]` prints daily counters (Claude requests and questions, input/output tokens, prompt-cache reads and writes, cached answers, TTS characters and cache hits, STT requests and seconds, limits hit). They are stored in the app cache and are not exposed by the API; `/api/health` only reports which services are configured.
- `php api/bin/warm-analyst.php` pre-generates the answers to the three suggested questions in three languages and both modes for the default scenario, plus the MP3 of each summary. It prints the plan (how many real calls) and does nothing until run with `--yes`.

## Privacy & legal

- **Responsible:** Luana Santos (individual project, team Lumi Lunar). Contact through the GitHub repository (issues); no personal e-mail is published.
- **IP addresses:** never stored in plain text. Only an HMAC-SHA256 hash with a secret salt (`IP_SALT`, or a file created outside the web root) is used for the hourly limits, and those records are deleted after 48 hours. Daily usage counters contain no address. `php api/bin/privacy-cleanup.php --scan` removes expired or old-format records and checks that no address appears in the cache (run it hourly from cron if you like).
- **Questions:** sent to Anthropic (USA) to generate the answer. Identical questions may be answered from a cache for 90 days; the cache holds only the answer and its tool calls under a hash of the question. Questions that look like personal data (e-mail, phone, CPF) are not cached. The Analyst shows a notice not to include personal data.
- **Voice:** microphone recordings are sent to ElevenLabs (USA) for transcription and are not stored (PHP's temporary upload is deleted right after); the first use shows a notice. Audio of answers read aloud is cached; it contains no user data.
- **International transfer:** Anthropic and ElevenLabs are in the USA; each processes data under its own terms. Nothing else is shared or sold.
- **No tracking cookies or analytics.** Only preferences (language, theme, mode, power inputs, microphone notice seen) are kept in the browser's local storage.
- **Rights (LGPD, art. 18):** confirmation, access, correction, anonymisation or deletion, information about sharing, withdrawal of consent — requested through GitHub. The hosting provider's web server logs may hold addresses under its own policy.
- **Terms:** educational and demonstration use; no warranty; not for operational mission decisions; not endorsed by NASA. Code under the Apache License 2.0. The in-app page is *Privacy & Terms* (`#/privacy`, linked in the footer).

## Status of claims

We use a fixed scale: *planned → integration tested → numerically verified → validated for scope*. Current status is shown on the Methodology screen from `data/validation.json`. Earth in view is a geometric line of sight, not a radio link budget. Landing safety (slope, rocks, thermal) is out of scope.

## Use of AI

See [AI_DISCLOSURE.md](AI_DISCLOSURE.md).

## Licence

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party components: [THIRD_PARTY.md](THIRD_PARTY.md).

---

### Guia rápido (PT)

1. `cd frontend && npm install && npm run build`
2. `cd ../api && cp config.example.php config.php` e coloque as chaves (ou use variáveis de ambiente).
3. Na raiz: `php -S localhost:8080 -t frontend/dist api/dev-router.php` (ou o comando Docker acima) e abra http://localhost:8080.
4. Antes de enviar: `php api/bin/validate.php` e `php api/bin/warm-cache.php` com internet, para ter números reais do JPL.
5. Relevo: baixe um DEM LOLA que cubra cada local e rode `preprocess/build_site_assets.py`.
6. Hospedagem: conteúdo de `frontend/dist` na raiz do site, pasta `api/` em `/api`, `config.php` criado no servidor, HTTPS ligado.
