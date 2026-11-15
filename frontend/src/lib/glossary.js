// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Glossary anchors (stable ids, same in every language) and the metric labels that link
 * to them with a "?" icon. Each label is an i18n key; its term is the glossary entry
 * that explains it. Tests check that every term exists in en/es/pt and every label maps.
 */
export const TERMS = [
  'azimuth', 'elevation', 'horizon-mask', 'geometric-terrain', 'dem', 'lola', 'horizons',
  'disc-range', 'p10-p90', 'earth-in-view', 'dsn', 'longest-dark', 'longest-gap', 'panel-factor', 'dod',
  'libration', 'set', 'provenance', 'validation-status', 'pgda-average', 'psr',
];

/**
 * Help glossary groups (theme → term ids). Every term is in exactly one group (tested).
 * Group titles: help.groups.<key>.
 */
export const TERM_GROUPS = [
  ['position', ['azimuth', 'elevation', 'horizons', 'libration', 'set']],
  ['terrain', ['horizon-mask', 'geometric-terrain', 'dem', 'lola', 'psr']],
  ['comm', ['earth-in-view', 'dsn', 'longest-gap']],
  ['energy', ['panel-factor', 'dod', 'longest-dark']],
  ['uncertainty', ['disc-range', 'p10-p90', 'pgda-average', 'provenance', 'validation-status']],
];

/** Group key of a term id (null if none). */
export const groupOf = (id) => TERM_GROUPS.find(([, ids]) => ids.includes(id))?.[0] ?? null;

export const LABEL_TERMS = {
  // Explorer readout and Compare table
  'common.sunlight': 'disc-range',
  'common.earthInView': 'earth-in-view',
  'common.both': 'earth-in-view',
  'common.comm': 'dsn',
  'common.longestCommGap': 'longest-gap',
  'common.longestDark': 'longest-dark',
  'common.longestEarthGap': 'longest-gap',
  'common.sunElevation': 'elevation',
  'common.earthElevation': 'elevation',
  'common.nextSunset': 'set',
  'common.nextEarthset': 'set',
  'common.panelVertical': 'panel-factor',
  'common.longTerm': 'pgda-average',
  'common.psrNear': 'psr',
  // Power & battery
  'power.panel': 'panel-factor',
  'power.orientation': 'panel-factor',
  'power.dod': 'dod',
  'power.energy': 'panel-factor',
  'power.balance': 'panel-factor',
  'power.deficit': 'panel-factor',
  'power.night': 'longest-dark',
  'power.battery': 'dod',
  // Compare
  'compare.sensitivity': 'p10-p90',
  'compare.withinRadius': 'p10-p90',
  // Sky view
  'common.sun': 'elevation',
  'common.earth': 'earth-in-view',
  'sky.skyline': 'horizon-mask',
};

export const termFor = (labelKey) => LABEL_TERMS[labelKey] || null;
