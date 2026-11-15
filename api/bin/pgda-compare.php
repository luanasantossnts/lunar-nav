<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Our model over a whole year vs NASA PGDA 69, printed as a table and saved to
 * data/pgda/comparison_<year>.json. Fetches the year from JPL Horizons the first time.
 * Usage: php bin/pgda-compare.php [year=2030]
 */

require __DIR__ . '/../src/bootstrap.php';

use LunarNav\Reference\PgdaComparison;
use LunarNav\Reference\ReferenceStore;

$year = (int) ($argv[1] ?? 2030);
$app = new LunarNav\App(lunarnav_config());
$ref = new ReferenceStore(LUNARNAV_ROOT . '/data/pgda');
$sites = array_values(array_filter($app->sites->all(), static fn($s) => is_file(LUNARNAV_ROOT . '/data/pgda/' . $s['id'] . '.json')));
$t = microtime(true);
$c = PgdaComparison::run($app->scenarios, $app->terrain, $ref, $sites, $year);
file_put_contents(LUNARNAV_ROOT . "/data/pgda/comparison_{$year}.json", json_encode($c + ['computed_at' => gmdate('c')], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
printf("%-17s %-9s %5s | %-24s %-24s %7s | %-24s %-14s %7s | %s\n", 'site', 'mode', 'PGDA', 'Sun ours (centre/first)', 'Sun PGDA (point/300m)', 'Δ pts', 'Earth ours (centre/first)', 'Earth PGDA', 'Δ pts', 'Sun 300 m: ours / PGDA / Δ');
foreach ($c['rows'] as $r) {
    $o = $r['ours']; $p = $r['pgda']; $d = $r['delta_points'];
    printf("%-17s %-9s %4dm | %5.1f%% / %5.1f%%          %5.1f%% / %5.1f%%          %+6.1f | %5.1f%% / %5.1f%%          %5.1f%%         %+6.1f | %s / %5.1f%% / %s\n",
        $r['site'], $r['mode'] . ($r['dem_m'] ? (int) $r['dem_m'] . 'm' : ''), $r['pgda_resolution_m'], 100 * $o['sun_centre'], 100 * $o['sun_first_limb'], 100 * $p['sun'], 100 * $p['sun_median_300m'], $d['sun'],
        100 * $o['earth_centre'], 100 * $o['earth_first_limb'], 100 * $p['earth'], $d['earth'],
        $o['sun_first_limb_median_300m'] === null ? '  —  ' : sprintf('%5.1f%%', 100 * $o['sun_first_limb_median_300m']), 100 * $p['sun_median_300m'], $d['sun_median_300m'] === null ? '—' : sprintf('%+.1f', $d['sun_median_300m']));
}
printf("ranking ours: %s\nranking PGDA: %s\nsame: %s · max |Δ Sun| at 40 m sites: %s · status: %s · %.0fs\n", implode(' > ', $c['ranking']['ours']), implode(' > ', $c['ranking']['pgda']), $c['ranking']['same'] ? 'yes' : 'NO', $c['max_abs_delta_sun_dem40'], $c['status'], microtime(true) - $t);
