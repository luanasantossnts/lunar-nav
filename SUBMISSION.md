# Submission kit — NASA Space Apps 2026 (Sorocaba)

Team **Lumi Lunar** · Project **Lunar Nav** · Challenge **Lunar Landing Site Navigator**
Submission window: **Sat 14 Nov 09:00 → Sun 15 Nov 23:59** (Sorocaba local time). The project page is under Profile → My Team → Project → Edit. Click **Save Progress** often. You can **Submit for Judging** as many times as you like before the deadline, and only the last version is judged, so submit an early version today.

## Order of work

1. **Real data.** Run `php api/bin/validate.php 2030-07-01 30` and `php api/bin/warm-cache.php 2030-07-01 30` with internet. Methodology must show real results.
2. **Online.** Deploy to HTTPS on a neutral domain. Optional but recommended: request a FortiGuard Web Filter classification (Category: Education or Web-based application; Company Name: N/A).
3. **Public repo.** Push to a public GitHub repository with LICENSE, README, REFERENCES and AI_DISCLOSURE. Do not commit `config.php` or any key.
4. **Form.** Fill the 8 fields below in English, then Save Progress.
5. **Early submit.** Tick Terms and Conditions and "Confirm All Work is Original", then Submit for Judging. Check the confirmation banner.
6. **Demo.** Make a video (30 s max, English subtitles) or slides (7 max, English). Host it with a public link that needs no login. Test the link in a private window.
7. **Re-submit.** Polish, then submit again before Sun 23:59.
8. **Certificate.** Download it from Profile → Participant Information.

Hard rules:
- No NASA or Space Apps logos, flags or mission insignia in the app, video or slides.
- No images, video or audio of anyone under 18.
- Any AI-generated image or video carries a visible "AI-generated" watermark.
- Everything is in English.

## The 8 form fields (paste-ready)

### 1 · Project Name
Lunar Nav

### 2 · High-Level Project Summary
NASA plans a Moon Base in the lunar south pole region, where the Sun skims the horizon and Earth slips in and out of view behind the terrain. Light and line of sight decide power, survival and communications, and both change with the date and the exact spot. Lunar Nav is a web app that answers a planner's first question for any south-pole site and landing date: when will this site have sunlight, a direct line of sight to Earth and contact through NASA's Deep Space Network, and how sure are we? It compares sites, shows what a landing delay changes, searches for dates that meet constraints, sizes the battery needed to survive the night, and shows how results change within a few hundred metres. Every number comes from NASA/JPL Horizons and NASA LOLA terrain, carries its provenance and is shown with its uncertainty range. Checked against NASA's long-term illumination maps (PGDA), it ranks five sites by sunlight in the same order.

### 3 · Link to Project Demo
`<public YouTube / Google Drive link — video ≤ 30 s with English subtitles, or ≤ 7 slides>`

### 4 · Link to Final Project
https://lunarnav.space (live app) · `<GitHub link>` (source code, Apache-2.0)

### 5 · Detailed Project Description
**Why now.** NASA plans a Moon Base in the lunar south pole region, where light, shadow and Earth visibility shape power, communications and operations. Lunar Nav gives a fast, transparent first look at those conditions for any site and date.

**What it does.** Lunar Nav compares lunar south-pole landing sites and landing dates by when the Sun and Earth are above the local horizon:
- **Explorer:** a polar map and a per-site readout. It shows sunlight %, Earth in view %, both at once, contact with Earth through NASA's Deep Space Network (DSN), the longest dark period, the longest gaps without Earth and without contact, the next sunset and Earthset, and a panel factor, plus a visibility timeline (with one lane per DSN complex) and an elevation chart.
- **Compare:** original vs. delayed landing for two sites, with the change in each metric. It also searches for landing dates that meet constraints (minimum sunlight, minimum Earth hours per day, minimum DSN contact hours per day, maximum dark period), and shows a sensitivity map of how the result changes on a grid of nearby points.
- **Sky view:** a 360° horizon panorama with the Sun and Earth tracks over the terrain skyline, and 3D terrain lit from the Sun's position at the chosen time, with terrain self-shadowing and earthlight when the Sun is down.
- **Analyst:** ask in plain language, typed or spoken, in English, Spanish or Portuguese. Claude answers only by calling Lunar Nav's own calculation tools, and cites every number. All tool calls are shown on screen. The summary of each answer can be read aloud. Repeated questions are answered from a cache.
- **Power & battery:** energy per day for an adjustable solar panel and the battery needed to survive the longest night. Illustrative, with every assumption listed (defaults: 400 W vertical tracking panel, 150 W load, 60 W survival, 80% depth of discharge, 150 Wh/kg). Example: IM-2, terrain, 30 days from 1 July 2030: 4.7 kWh/day, a 363 h night, a 27.3 kWh battery (about 182 kg).
- **Long-term reference:** for each site, NASA PGDA's 18.6-year average sunlight and Earth visibility, and the share of permanent shadow within 300 m (Shackleton ridge: Sun 72.7%, Earth 51.9%; Malapert: 20% permanent shadow nearby).
- **Charts:** six charts of the same data, each with a data table: sites side by side with their ranges, 2030 month by month, ours vs NASA PGDA, battery by site, what a 10-day delay changes, and the ±300 m sunlight histogram. They show that where you land matters: Malapert gets 0% sunlight from January to June 2030, and within 300 m its battery need ranges from 1.7 kWh to at least 108 kWh. At IM-2, when you land decides whether you arrive in daylight: 0 h of daylight before the first night on 1 July 2030, 250.8 h ten days later.
- **Report:** a printable/PDF scenario report, with JSON, CSV and Markdown exports.
- **Methodology:** premises, validation status, known limits and the full provenance of the current result.
- **Help:** a how-to guide, a glossary of about 20 terms linked from "?" icons next to the labels, and an FAQ.
- **Accessibility:** works on phones; zero axe violations across all screens in both themes; keyboard navigation.

**Honest numbers.** Each sunlight or Earth-visibility fraction is shown with two ranges:
- *disc range:* from the first limb to the full disc of the Sun (±0.267°) or Earth (±0.95°);
- *position range:* P10–P90 over a terrain grid within ±300 m of the site, because published coordinates are approximate, and real landings can miss their target by hundreds of metres.

This changes the conclusions. On the Shackleton rim ridge, the published point gets 99.8% sunlight in July 2030, but within 300 m the P10–P90 range is only 48–73%. Landing precision matters as much as site choice.

**Contact with Earth.** Seeing Earth is not enough to talk to it: a ground antenna must also see the Moon. Lunar Nav computes *contact* as Earth in view from the site (with the chosen horizon model and margin) **and** at least one of the three DSN 70-m antennas (DSS-14 Goldstone, DSS-43 Canberra, DSS-63 Madrid) seeing the Moon at 10° or more (adjustable 0–20°). Antenna coordinates come from the DSN Telecommunications Link Design Handbook 810-005, module 301 Rev. P, Table 5 (WGS 84). The result: at the pole, the lunar horizon limits contact, not the network. Over 30 days from 1 July 2030 the three complexes together see the Moon 99.1% of the time (longest network gap 0.67 h), so contact is only 0.4–0.9 points below Earth in view at every site (Shackleton ridge, terrain: 42.5% Earth in view, 42.1% contact). The longest gap without contact, 347.4 h at Shackleton, is set entirely by Earth sinking below the local horizon. At IM-1, where Earth never sets, contact is 99.1%: the only gaps come from the network.

**Independent check against NASA PGDA.** We ran our model over the whole year 2030 (terrain mode, a body counted as visible when any part of its disc is up, as PGDA counts it) and compared it with NASA PGDA's 18.6-year averages (Mazarico et al. 2011, product 69). The ranking of the five sites by sunlight is identical: Shackleton ridge > Chandrayaan-3 > IM-2 > IM-1 > Malapert. At the site points, sunlight differs by +9.3 (Shackleton ridge), −1.2 (IM-2), +3.2 (IM-1) and +1.6 (Chandrayaan-3) points, and by −10.7 points at Malapert; Earth visibility agrees within ±3.1 points everywhere. Malapert sits on a slope whose skyline forms within 1 km, so the exact spot decides: within 300 m our median and PGDA's agree within 4.8 points, and NASA's own map at that point reads 18.8% from the nearest pixel and 29.0% when interpolated, so the reference itself moves by about 10 points there. Expected differences come from one year versus 18.6 years, 40/60 m versus 60/120 m elevation models, and an observer 2 m above the ground versus at the surface. The app labels this check "needs investigation" because Malapert is just outside the 10-point tolerance we set beforehand; we did not tune anything to agree.

**How it works.** A PHP API asks the JPL Horizons API for the topocentric azimuth and elevation of the Sun and Earth, seen by an observer standing at each site on the lunar surface (DE441 ephemerides, airless), and the Moon's azimuth and elevation seen from each DSN antenna. Metrics are computed per interval between samples, with horizon crossings interpolated. The terrain horizon comes from NASA LOLA elevation models: a Python pipeline casts rays around each site and computes the true elevation angle of the skyline on a sphere. Where the elevation model does not cover a site, the app says "terrain unavailable" instead of guessing. Results are cached, and each one carries its data source, method version, parameters and margins. The status of each claim is stated on a fixed scale: planned → integration tested → numerically verified → validated for scope.

**Benefits.**
- A fast, transparent first pass for choosing sites and dates, with uncertainty made visible.
- Shows what a landing delay changes (daylight left before the first night, Earth contact).
- Plain-language access for students and non-specialists, in three languages, without hiding the method.

**Goals.** Make the Sun and Earth visibility trade-offs at the lunar south pole understandable and checkable for mission planners, students and the public, using open NASA data.

**Tools.**
- PHP 8 (API, no framework).
- React 18, Vite, Tailwind CSS and three.js (interface and 3D).
- Python with numpy, rasterio and pyproj (terrain processing).
- JPL Horizons API, NASA LOLA elevation data, NASA Scientific Visualization Studio API.
- Anthropic Claude (analyst); ElevenLabs (read-aloud and speech input).
- Light and dark themes; English, Spanish and Portuguese. Open source under Apache-2.0.

### 6 · Use of Super Intelligence (SI)
Yes.
- **Building the project.** The idea is the author's own. She chose the challenge, conceived the solution and its improvements from her own study, and made the product and design decisions. AI (Claude by Anthropic; ChatGPT by OpenAI for one review) was used as a tool to refine the technical plan and to speed up implementation: drafting and reviewing source code, tests, documentation and the specification. The author ran the real JPL Horizons tests, and reviewed and accepted every change. Every source file carries an "AI-assisted" header comment, `package.json` has an `x-ai-assisted` field, and AI_DISCLOSURE.md in the repository gives details.
- **Inside the app.** The Analyst uses Claude (Anthropic). The model may only call Lunar Nav's calculation tools, and may not state any number that does not come from a tool result. Its answers are labelled as AI text. Read aloud uses ElevenLabs (AI voice; labelled); if unavailable, the browser's built-in speech. Speech input uses ElevenLabs speech-to-text. Both ElevenLabs features are active in the live demo. Repeated questions are answered from a cache, and usage is capped per hour and per day.
- **What AI does not produce.** All numbers are computed by deterministic code from NASA/JPL data, not by AI. No AI-generated images or video are used. Any that are added will carry a visible watermark.

### 7 · NASA Data
- **JPL Horizons API (NASA/JPL Solar System Dynamics).** Topocentric azimuth and elevation of the Sun (10) and Earth (399) for observers on the lunar surface (CENTER='coord@301', geodetic site coordinates, DE441, airless). This is the core of every metric. https://ssd-api.jpl.nasa.gov/doc/horizons.html
- **LRO Lunar Orbiter Laser Altimeter (LOLA) gridded polar DEMs** LDEM_80S_40M and LDEM_75S_60M (LRO-L-LOLA-4-GDR-V1.0, V2.0, PDS Geosciences Node). Used to compute each site's 360° terrain horizon (150 km great-circle rays, every 0.5°), the sensitivity grid of 121 nearby points, and the 3D terrain. In terrain mode, over 30 days from 1 July 2030, IM-2 loses 5.6 points of sunlight but gains 12 points of Earth visibility versus a flat horizon. https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- **JPL Horizons, DSN stations as observers.** Azimuth and elevation of the Moon (301) seen from the DSN 70-m antennas DSS-14, DSS-43 and DSS-63 (CENTER='DSS-14@399' etc., airless; one-hour step, checked against 10 minutes: |Δ| ≤ 0.0004 in coverage). Combined with Earth visibility from the site to give DSN contact.
- **NASA Deep Space Network station coordinates.** DSN Telecommunications Link Design Handbook 810-005, module 301 Rev. P (*Coverage and Geometry*, 2026), Table 5, geodetic coordinates on WGS 84; the site coordinates Horizons reports match it. https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf
- **NASA PGDA product 69, Lunar Polar Illumination (LOLA).** Average Sun and Earth visibility over ~18.6 years and permanently shadowed regions (60, 120 and 240 m/px), shown as the long-term average for each site and used to validate our model: identical site ranking by sunlight, Sun within −1.2 to +9.3 points at four sites (Malapert −10.7), Earth within ±3.1 points. https://pgda.gsfc.nasa.gov/products/69
- **LRO Camera (LROC) published coordinates.** Landing-site and Apollo site positions (LROC Featured Images 938, 1247 and 1401).
- **NASA's Scientific Visualization Studio API.** Context visualizations shown in the app with credit: SVS 5013 *Artemis III Landing Region Candidates*, 4716 *Visualizing Shackleton Crater*, 4770 *From Apollo Sites To The South Pole*, 4119 *Moon Phase and Libration*, 5228 *Lunar South Pole Illumination with Earth and Sun*, and 5127 *Lunar South Pole Terrain in Coded Color*. https://svs.gsfc.nasa.gov/

### 8 · Space Agency Partner Data and Other References
**Space Agency Partner data:** ISRO (Indian Space Research Organisation). The Chandrayaan-3 Vikram landing site (Statio Shiv Shakti, 69.373°S 32.319°E), as published by ISRO (coordinates via Wikipedia, citing ISRO), is used as a comparison site.

**Other references:**
- Giorgini et al. (1996), JPL's On-Line Solar System Data Service, BAAS 28, 1158.
- Park et al. (2021), The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161:105.
- Smith et al. (2010), The Lunar Orbiter Laser Altimeter Investigation on the LRO Mission, Space Sci. Rev. 150, 209–241.
- Mazarico et al. (2011), Illumination conditions of the lunar polar regions using LOLA topography, Icarus 211, 1066–1081.
- Site sources: LROC Featured Images 938, 1247 and 1401; Wikipedia (IM-1, Peak of eternal light, Statio Shiv Shakti).
- Software: React, three.js, Vite, Tailwind CSS, numpy, rasterio, pyproj, Pillow; IBM Plex fonts (OFL).
- NASA, "Lunar South Pole Region" (Moon Base), updated 3 Nov 2026 — context for the problem statement. https://www.nasa.gov/reference/moonbase-environment/
- AI services: Anthropic Claude (analyst) and ElevenLabs (AI voice and speech-to-text), both used in the live demo.

The full list with links is in REFERENCES.md and THIRD_PARTY.md in the repository. No data, tools or services from China or Chinese-owned entities are used.

## Demo — 30-second video (follows the official structure)

| Time | Shot | English subtitle |
|---|---|---|
| 0:00–0:02 | Title card: Lunar Nav · Lumi Lunar | "I'm Luana Santos, team Lumi Lunar." |
| 0:02–0:05 | Briefing headline | "Challenge: Lunar Landing Site Navigator. Your landing slipped ten days." |
| 0:05–0:09 | Explorer: map with two sites | "Lunar Nav — when does your site see the Sun and Earth?" |
| 0:09–0:15 | Charts: battery by site (Malapert's dashed ±300 m box), then 2030 month by month (Malapert flat at 0% until June) | "Where you land matters: at Malapert, 300 m changes the battery you need by over 100 kWh." |
| 0:15–0:21 | Charts: what a 10-day delay changes (IM-2 bar from 0 h to 250.8 h) → Sky view 3D at IM-2 | "And at IM-2, when you land decides whether you arrive in daylight." |
| 0:21–0:30 | Analyst answering with citations, then the link | "NASA JPL Horizons and LOLA terrain, every number cited, in three languages. Plan landings with open NASA data." |

No logos, no people under 18, and screen recordings only (no AI-generated footage).
