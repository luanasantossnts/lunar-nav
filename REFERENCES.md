# References

Every source used by Lunar Nav — data, services, papers and software. Open sources are cited too, as the Space Apps rules require.

## Data and services

1. **JPL Horizons System** — NASA/JPL Solar System Dynamics. Ephemerides of the Sun and Earth for observers on the lunar surface. API documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html · Manual: https://ssd.jpl.nasa.gov/horizons/manual.html
2. **JPL: lunar reference frames and DE440** — https://ssd.jpl.nasa.gov/announcements/an20210929.html
3. **LRO Lunar Orbiter Laser Altimeter (LOLA)**, PDS Geosciences Node — https://pds-geosciences.wustl.edu/missions/lro/lola.htm
4. **LOLA gridded polar DEMs used** (LRO-L-LOLA-4-GDR-V1.0, product version V2.0, PDS Geosciences Node):
   - LDEM_80S_40M — 40 m/px, 80°S–90°S, for Shackleton, IM-2 and Malapert — https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_40m.img
   - LDEM_75S_60M — 60 m/px, 75°S–90°S, for IM-1 (80.1°S, so its 150 km horizon rays stay inside the DEM) — https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_60m.img
     Also used for the *DEM resolution sensitivity* check (Methodology → Validation): the Shackleton ridge horizon mask rebuilt from this 60 m DEM with the same method (`api/data/terrain-dem60/shackleton_ridge/mask.json`), giving 91.4 % sunlight against 99.8 % with LDEM_80S_40M for the default scenario (30 days from 1 July 2030). Reproduce with `preprocess/build_site_assets.py --ids shackleton_ridge --max-dist-km 150 --az-step 0.5 --observer-height 2 --skip-grid` on a crop of this DEM, then `php bin/validate.php`.
   - Heights are DN × 0.5 m relative to the 1737.4 km sphere (the label's OFFSET is the sphere radius, not added to heights).
5. **NASA PGDA, Lunar polar illumination** (product 69) — https://pgda.gsfc.nasa.gov/products/69 — Mazarico et al. (2011). Average Sun visibility (`AVGVISIB_*_201608`), average Earth visibility (`AVGVISIB_*_201608_EARTH`) and permanently shadowed regions (`LPSR_*_201608`), V1.05 (2016-09-15), hourly over ~18.6 years; a body counts as visible when *any fraction of its disc* is up (product labels). Used at 60 m/px (85°S–90°S: Shackleton ridge, Malapert), 120 m/px (75°S–90°S: IM-2, IM-1) and 240 m/px (65°S–90°S: Chandrayaan-3), read as tiled GeoTIFFs from https://pgda.gsfc.nasa.gov/data/MoonIllumination/ by `preprocess/pgda_reference.py` (stored in `api/data/pgda/`). Shown in the app as the long-term average and used for the independent validation of our model.
6. **NASA's Scientific Visualization Studio (SVS)** — context visualizations, fetched through the public SVS API (https://svs.gsfc.nasa.gov/api/<id>, for example https://svs.gsfc.nasa.gov/api/5228):
   - SVS 5013, *Artemis III Landing Region Candidates* — https://svs.gsfc.nasa.gov/5013/
   - SVS 4716, *Visualizing Shackleton Crater* — https://svs.gsfc.nasa.gov/4716/
   - SVS 4770, *From Apollo Sites To The South Pole* — https://svs.gsfc.nasa.gov/4770/
   - SVS 4119, *Moon Phase and Libration, 2014 South Up* — https://svs.gsfc.nasa.gov/4119/
   - SVS 5228, *Lunar South Pole Illumination with Earth and Sun* — https://svs.gsfc.nasa.gov/5228/ (the animation shown on NASA's "Lunar South Pole Region" page below; same media file, `southpole_earth_sun_1080p30.mp4`)
   - SVS 5127, *Lunar South Pole Terrain in Coded Color* — https://svs.gsfc.nasa.gov/5127/ (the flight to the south pole, natural colour to coded elevation with 30 labelled features, from LRO data, shown on NASA's Moon Base page https://www.nasa.gov/moonbase/ in "Why the Lunar South Pole region?"; same media file, `lola_sp_1080p30.mp4`, 29 653 172 bytes on both sites)
7. **LROC QuickMap** — https://quickmap.lroc.asu.edu/ (used to check site coordinates)
8. **NASA Deep Space Network station coordinates** — *DSN Telecommunications Link Design Handbook* 810-005, Module 301, Rev. P, *Coverage and Geometry* (JPL, issue date 22 May 2026), Table 5: geodetic coordinates with respect to the WGS 84 ellipsoid. Used for the 70-m antennas DSS-14 (Goldstone), DSS-43 (Canberra) and DSS-63 (Madrid). The Moon's azimuth/elevation from each antenna comes from JPL Horizons with CENTER='DSS-14@399', 'DSS-43@399' and 'DSS-63@399'; the site coordinates Horizons reports match Table 5. Stored in `api/data/dsn.json`. — https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf
9. **NASA, "Lunar South Pole Region"**, Moon Base, updated 3 Nov 2026 — https://www.nasa.gov/reference/moonbase-environment/ (context only: why light, shadow and Earth visibility matter at the south pole)

## Space Agency Partner data

- **CSA (Canadian Space Agency) — Moon exploration portal**, listed in this challenge's resources — https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ . Context only; no CSA data or landing site is used, because the pages give no landing coordinates. Text quoted (Credit: Canadian Space Agency), under the CSA's terms for non-commercial, informational reuse (https://www.asc-csa.gc.ca/eng/terms.asp); no CSA logo is used and no association with or endorsement by the CSA is implied:
  - *First Canadian rover to explore the Moon* (date modified 2026-04-21; status "Project ended") — https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/first-canadian-rover-to-explore-the-moon.asp : "The Canadian rover was set to land on the south pole of the Moon, with a suite of scientific payloads." and "Its mission objective was to explore a region of the lunar south pole and gather scientific data to help find water ice".
  - *A Canadian utility rover on the Moon* (date modified 2026-09-03; concept development) — https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canadian-utility-rover-on-the-moon.asp : the rover must "survive the roughly two-week-long lunar night, with temperatures as low as -200 °C".
- **ISRO (Indian Space Research Organisation)**: Chandrayaan-3 Vikram landing site (Statio Shiv Shakti, 69.373°S 32.319°E), as published by ISRO. Used as a comparison site at a lower south-polar latitude. Secondary reference: https://en.wikipedia.org/wiki/Statio_Shiv_Shakti

## Site coordinates

| Site | Source |
|---|---|
| Shackleton rim at the de Gerlache ridge | LROC Featured Image 1247, *Traversing the Shackleton de Gerlache Ridge* — https://lroc.im-ldi.com/images/1247 |
| IM-2 Athena, Mons Mouton region | LROC Featured Image 1401, *IM-2 Landing Region* — https://lroc.im-ldi.com/images/1401 |
| IM-1 Odysseus | Wikipedia, *IM-1* (landing site) — https://en.wikipedia.org/wiki/IM-1 |
| Malapert Mountain (approx.) | Wikipedia, *Peak of eternal light* — https://en.wikipedia.org/wiki/Peak_of_eternal_light (secondary source; marked unverified in the app) |
| Chandrayaan-3 (Statio Shiv Shakti) | Wikipedia, *Statio Shiv Shakti*, citing ISRO — https://en.wikipedia.org/wiki/Statio_Shiv_Shakti |
| Apollo 11, 12, 14, 15, 16, 17 | LROC, *Spacecraft Related Coordinates — 2016 Update* — https://www.lroc.im-ldi.com/images/938 |

## Papers

- Giorgini, J. D. et al. (1996). JPL's On-Line Solar System Data Service. *Bulletin of the American Astronomical Society* 28, 1158.
- Park, R. S., Folkner, W. M., Williams, J. G., Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. *The Astronomical Journal* 161:105.
- Smith, D. E. et al. (2010). The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission. *Space Science Reviews* 150, 209–241.
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081.

## Software, fonts and AI services

See [THIRD_PARTY.md](THIRD_PARTY.md) and [AI_DISCLOSURE.md](AI_DISCLOSURE.md).

## Challenge

NASA Space Apps Challenge 2026, *Lunar Landing Site Navigator* — https://www.spaceappschallenge.org/
