// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Site names for display. Proper names stay as they are; the descriptive part is translated
 * through the locale keys siteNames.<id> (English keys equal api/data/sites.json). IDs, API
 * requests and the Analyst cache keys never use these names. A site without a key (a custom
 * point) keeps the name it has.
 */

/** Display name of a site (object or id) in the language of `t`. */
export function localSiteName(t, site, sites = []) {
  const id = typeof site === 'string' ? site : site?.id;
  if (!id) return '';
  const key = `siteNames.${id}`;
  const v = t(key);
  if (typeof v === 'string' && v !== key) return v;
  if (typeof site === 'string') return sites.find((s) => s.id === site)?.name || site;
  return site?.name || id;
}

/** Short label for maps and charts: the part before the comma or the "at / na / en" connector. */
export const shortSiteName = (name) => String(name || '').split(/,| at | na | en /)[0];
