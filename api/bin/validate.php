<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Validation run against the live JPL Horizons API. Writes data/validation.json,
 * which the Methodology page displays.
 *
 * Checks:
 *  1. Control site (Apollo 11): Earth always above the horizon, high elevation.
 *  2. Time-step convergence: metrics at 60, 10 and 1 minute steps for the default pair.
 *  3. Terrain products present for the default pair.
 *  4. Time-step convergence in terrain mode.
 *  5. Solar disc range (first limb … full disc), informative.
 *  6. Position spread: P10–P90 of the sensitivity grid within 300 m.
 *  7. DSN: Moon coverage by the three 70-m complexes, and its 60 vs 10 min convergence.
 *  8. Power: API energy equals P × panel_factor × period hours (0.1 %).
 *  9. Full nights: measured over the period ±15 days, never shorter than within the period.
 * 10. Independent check vs NASA PGDA 69: a whole year of our model against 18.6-year averages.
 * 11. DEM resolution sensitivity (informative): Shackleton with the 60 m (LDEM_75S_60M) mask.
 *
 * Each check carries a key and language-neutral params; the front end builds the text in
 * the user's language (name/result stay as an English fallback).
 * Uses only cached ephemerides when the default pair has been computed at 60 and 10 min.
 * Usage: php bin/validate.php [start=2030-07-01] [days=30]
 */

require __DIR__ . '/../src/bootstrap.php';

use LunarNav\Agent\Tools;

$app = new LunarNav\App(lunarnav_config());
$start = $argv[1] ?? '2030-07-01';
$days = (int) ($argv[2] ?? 30);
$checks = [];

// 1. Control site
try {
    $r = $app->handle('GET', '/metrics', ['site' => 'apollo11', 'start' => $start, 'days' => (string) $days], []);
    $e = $r['metrics']['earth'];
    $ok = $e['fraction'] === 1.0 && $e['elevation']['min'] > 45;
    $checks[] = [
        'id' => 'control_apollo11',
        'key' => 'control',
        'params' => ['site' => 'apollo11', 'earth' => sprintf('%.1f', 100 * $e['fraction']), 'min' => sprintf('%.2f', $e['elevation']['min']), 'max' => sprintf('%.2f', $e['elevation']['max'])],
        'name' => 'Control site, Apollo 11',
        'status' => $ok ? 'integration tested' : 'failed',
        'result' => sprintf('Earth in view %.1f%%, elevation %.2f° to %.2f°', 100 * $e['fraction'], $e['elevation']['min'], $e['elevation']['max']),
    ];
} catch (Throwable $ex) {
    $checks[] = ['id' => 'control_apollo11', 'key' => 'control', 'params' => ['site' => 'apollo11'], 'name' => 'Control site, Apollo 11', 'status' => 'error', 'result' => $ex->getMessage()];
}

// 1b. DSN: Moon coverage by the union of the three complexes, and its time-step convergence.
try {
    $t0 = Tools::parseDate($start);
    $t1 = $t0 + $days * 86400;
    $c60 = $app->scenarios->dsnCoverage($t0, $t1, 60);
    $c10 = $app->scenarios->dsnCoverage($t0, $t1, 10);
    $diff = abs($c60['union'] - $c10['union']);
    foreach ($c10['stations'] as $sid => $f) {
        $diff = max($diff, abs($f - $c60['stations'][$sid]));
    }
    $tol = 0.005;
    $checks[] = [
        'id' => 'convergence_dsn',
        'key' => 'dsn_convergence',
        'params' => ['el' => sprintf('%.0f', $c10['min_elevation_deg']), 'u60' => sprintf('%.4f', $c60['union']), 'u10' => sprintf('%.4f', $c10['union']), 'diff' => sprintf('%.4f', $diff), 'tol' => sprintf('%.3f', $tol), 'step' => (string) (new LunarNav\Dsn\DsnNetwork(LUNARNAV_ROOT . '/data/dsn.json'))->stepMinutes()],
        'name' => 'Time-step convergence, DSN stations',
        'status' => $diff <= $tol ? 'numerically verified' : 'needs smaller step',
        'result' => sprintf('Moon ≥ %.0f° at DSN union: 60 min %.4f vs 10 min %.4f; max |Δ| (union and stations) %.4f (tolerance %.3f); app step %d min', $c10['min_elevation_deg'], $c60['union'], $c10['union'], $diff, $tol, (new LunarNav\Dsn\DsnNetwork(LUNARNAV_ROOT . '/data/dsn.json'))->stepMinutes()),
        'detail' => ['60' => $c60, '10' => $c10],
    ];
    $checks[] = [
        'id' => 'dsn_coverage',
        'key' => 'dsn_coverage',
        'params' => ['union' => sprintf('%.1f', 100 * $c10['union']), 'days' => (string) $days, 'gap' => sprintf('%.2f', $c10['longest_gap_h']), 'stations' => implode(' · ', array_map(static fn($k, $v) => sprintf('%s %.1f%%', $k, 100 * $v), array_keys($c10['stations']), $c10['stations']))],
        'name' => 'DSN coverage of the Moon (sanity)',
        'status' => $c10['union'] >= 0.9 ? 'integration tested' : 'failed',
        'result' => sprintf('union %.1f%% of %d days, longest gap %.2f h; %s', 100 * $c10['union'], $days, $c10['longest_gap_h'], implode(' · ', array_map(static fn($k, $v) => sprintf('%s %.1f%%', $k, 100 * $v), array_keys($c10['stations']), $c10['stations']))),
        'detail' => $c10,
    ];
} catch (Throwable $ex) {
    $checks[] = ['id' => 'dsn_coverage', 'key' => 'dsn_coverage', 'params' => [], 'name' => 'DSN coverage of the Moon (sanity)', 'status' => 'error', 'result' => $ex->getMessage()];
}

// 2. Convergence
foreach ($app->sites->defaultPair() as $id) {
    $rows = [];
    try {
        foreach ([60, 10, 1] as $step) {
            $d = $step === 1 ? min($days, 7) : $days; // 1-minute runs are limited to 7 days (row count)
            $r = $app->handle('GET', '/metrics', ['site' => $id, 'start' => $start, 'days' => (string) $d, 'step' => (string) $step], []);
            $rows[$step] = ['days' => $d, 'sun' => $r['metrics']['sun']['fraction'], 'earth' => $r['metrics']['earth']['fraction'], 'both' => $r['metrics']['both']['fraction']];
        }
        // Compare 60 and 10 minutes over the same period.
        $diff = max(abs($rows[60]['sun'] - $rows[10]['sun']), abs($rows[60]['earth'] - $rows[10]['earth']), abs($rows[60]['both'] - $rows[10]['both']));
        $tol = 0.005;
        $checks[] = [
            'id' => 'convergence_' . $id,
            'key' => 'convergence',
            'params' => ['site' => $id, 'diff' => sprintf('%.4f', $diff), 'tol' => sprintf('%.3f', $tol)],
            'name' => 'Time-step convergence, ' . $id,
            'status' => $diff <= $tol ? 'numerically verified' : 'needs smaller step',
            'result' => sprintf('max |Δ fraction| 60 min vs 10 min = %.4f (tolerance %.3f)', $diff, $tol),
            'detail' => $rows,
        ];
    } catch (Throwable $ex) {
        $checks[] = ['id' => 'convergence_' . $id, 'key' => 'convergence', 'params' => ['site' => $id], 'name' => 'Time-step convergence, ' . $id, 'status' => 'error', 'result' => $ex->getMessage()];
    }
    $av = $app->terrain->availability($id);
    $checks[] = [
        'id' => 'terrain_' . $id,
        'key' => $av['mask'] ? 'terrain_mask' : 'terrain_missing',
        'params' => ['site' => $id],
        'name' => 'Terrain mask, ' . $id,
        'status' => $av['mask'] ? 'integration tested' : 'planned',
        'result' => $av['mask'] ? 'mask present' : 'not built yet',
    ];
    if (!$av['mask']) {
        continue;
    }

    // 4. Convergence with the terrain horizon (crossings against a skyline, not 0°).
    try {
        $tr = [];
        foreach ([60, 10] as $step) {
            $r = $app->handle('GET', '/metrics', ['site' => $id, 'start' => $start, 'days' => (string) $days, 'step' => (string) $step, 'mode' => 'terrain'], []);
            $tr[$step] = ['sun' => $r['metrics']['sun']['fraction'], 'earth' => $r['metrics']['earth']['fraction'], 'both' => $r['metrics']['both']['fraction']];
            if ($step === 60) $terrain60 = $r;
        }
        $diff = max(abs($tr[60]['sun'] - $tr[10]['sun']), abs($tr[60]['earth'] - $tr[10]['earth']), abs($tr[60]['both'] - $tr[10]['both']));
        $tol = 0.005;
        $checks[] = [
            'id' => 'convergence_terrain_' . $id,
            'key' => 'convergence_terrain',
            'params' => ['site' => $id, 'diff' => sprintf('%.4f', $diff), 'tol' => sprintf('%.3f', $tol)],
            'name' => 'Time-step convergence (terrain), ' . $id,
            'status' => $diff <= $tol ? 'numerically verified' : 'needs smaller step',
            'result' => sprintf('max |Δ fraction| 60 min vs 10 min = %.4f (tolerance %.3f)', $diff, $tol),
            'detail' => $tr,
        ];

        // 5. Solar disc range (informative): first limb … centre … full disc.
        $dr = $terrain60['metrics']['sun']['disc_range'];
        $checks[] = [
            'id' => 'sun_disc_' . $id,
            'key' => 'sun_disc',
            'params' => ['site' => $id, 'first' => sprintf('%.1f', 100 * $dr['first_limb']['fraction']), 'centre' => sprintf('%.1f', 100 * $dr['centre']['fraction']), 'full' => sprintf('%.1f', 100 * $dr['full_disc']['fraction']), 'r' => sprintf('%.3f', $dr['radius_deg'])],
            'name' => 'Sun disc range (terrain), ' . $id,
            'status' => 'integration tested',
            'result' => sprintf('first limb %.1f%% · centre %.1f%% · full disc %.1f%% (r = %.3f°)', 100 * $dr['first_limb']['fraction'], 100 * $dr['centre']['fraction'], 100 * $dr['full_disc']['fraction'], $dr['radius_deg']),
            'detail' => $dr,
        ];

        // 5b. Power consistency: API energy = P × panel_factor × period hours (default inputs).
        $pw = $terrain60['metrics']['power'];
        $pf = $pw['params']['orientation'] === 'horizontal' ? $terrain60['metrics']['sun']['panel_factor']['horizontal'] : $terrain60['metrics']['sun']['panel_factor']['vertical'];
        $expected = $pw['params']['panel_w'] * $pf * $terrain60['metrics']['period']['hours'];
        $rel = $expected > 0 ? abs($pw['energy_wh'] - $expected) / $expected : abs($pw['energy_wh']);
        $checks[] = [
            'id' => 'power_consistency_' . $id,
            'key' => 'power',
            'params' => ['site' => $id, 'energy' => sprintf('%.1f', $pw['energy_wh']), 'p' => sprintf('%.0f', $pw['params']['panel_w']), 'pf' => sprintf('%.4f', $pf), 'hours' => sprintf('%.0f', $terrain60['metrics']['period']['hours']), 'expected' => sprintf('%.1f', $expected), 'rel' => sprintf('%.3f', 100 * $rel), 'battery' => sprintf('%.2f', $pw['battery_kwh']), 'night' => sprintf('%.1f', $pw['longest_night_h'])],
            'name' => 'Power consistency, ' . $id,
            'status' => $rel <= 0.001 ? 'numerically verified' : 'failed',
            'result' => sprintf('energy %.1f Wh vs P × panel_factor × hours = %.0f × %.4f × %.0f = %.1f Wh (|Δ| %.3f%%, tolerance 0.1%%); battery %.2f kWh for a %.1f h night', $pw['energy_wh'], $pw['params']['panel_w'], $pf, $terrain60['metrics']['period']['hours'], $expected, 100 * $rel, $pw['battery_kwh'], $pw['longest_night_h']),
        ];

        // 5c. Full nights: the night measured over the extended window is ≥ the one seen in the period.
        $ws = $app->handle('GET', '/metrics', ['site' => $id, 'start' => $start, 'days' => (string) $days, 'mode' => 'terrain', 'series' => '1'], []);
        $mask = $app->terrain->mask($id);
        $hz = static fn(float $az): float => $mask->at($az);
        $pStart = $ws['metrics']['period']['start'];
        $pEnd = $ws['metrics']['period']['end'];
        $inPeriod = LunarNav\Metrics\Metrics::longestGapInfo(LunarNav\Metrics\Metrics::spans($ws['series']['sun'], $hz, 0.0), $pStart, $pEnd);
        $full = $ws['metrics']['sun']['longest_hidden_h'];
        $bounds = (int) $ws['metrics']['sun']['longest_hidden_lower_bound'] + (int) $ws['metrics']['earth']['longest_hidden_lower_bound'] + (int) (($ws['metrics']['comm']['longest_gap_lower_bound'] ?? false));
        $checks[] = [
            'id' => 'full_nights_' . $id,
            'key' => 'full_nights',
            'params' => ['site' => $id, 'full' => sprintf('%.1f', $full), 'period' => sprintf('%.1f', $inPeriod[0] / 3600), 'bounds' => (string) $bounds],
            'name' => 'Full nights (±15 d window), ' . $id,
            'status' => $full + 0.01 >= round($inPeriod[0] / 3600, 2) ? 'numerically verified' : 'failed',
            'result' => sprintf('longest night %.1f h in full vs %.1f h within the period only; still lower bounds: %d of 3 (Sun, Earth, contact)', $full, $inPeriod[0] / 3600, $bounds),
        ];

        // 6. Position spread: P10–P90 of grid points within 300 m.
        $ps = $app->scenarios->positionSpread($app->sites->resolve(['site' => $id]), Tools::parseDate($start), $days, 60, 0.0, 0.0);
        $checks[] = $ps['available'] ? [
            'id' => 'position_' . $id,
            'key' => 'position',
            'params' => ['site' => $id, 'radius' => (string) (int) $ps['radius_m'], 's10' => sprintf('%.1f', 100 * $ps['sun']['p10']), 's90' => sprintf('%.1f', 100 * $ps['sun']['p90']), 'smed' => sprintf('%.1f', 100 * $ps['sun']['median']), 'e10' => sprintf('%.1f', 100 * $ps['earth']['p10']), 'e90' => sprintf('%.1f', 100 * $ps['earth']['p90']), 'points' => (string) $ps['points'], 'spacing' => (string) (int) $ps['spacing_m']],
            'name' => 'Position spread ±' . (int) $ps['radius_m'] . ' m, ' . $id,
            'status' => 'integration tested',
            'result' => sprintf('Sun P10–P90 %.1f–%.1f%% (median %.1f%%) · Earth %.1f–%.1f%% · %d points at %d m', 100 * $ps['sun']['p10'], 100 * $ps['sun']['p90'], 100 * $ps['sun']['median'], 100 * $ps['earth']['p10'], 100 * $ps['earth']['p90'], $ps['points'], (int) $ps['spacing_m']),
            'detail' => $ps,
        ] : ['id' => 'position_' . $id, 'key' => 'position_missing', 'params' => ['site' => $id], 'name' => 'Position spread, ' . $id, 'status' => 'planned', 'result' => $ps['reason']];
    } catch (Throwable $ex) {
        $checks[] = ['id' => 'terrain_checks_' . $id, 'key' => 'terrain_checks', 'params' => ['site' => $id], 'name' => 'Terrain checks, ' . $id, 'status' => 'error', 'result' => $ex->getMessage()];
    }
}

// 10. Independent check vs NASA PGDA 69 (18.6-year averages), our model over a whole year.
try {
    $ref = new LunarNav\Reference\ReferenceStore(LUNARNAV_ROOT . '/data/pgda');
    $refSites = array_values(array_filter($app->sites->all(), static fn($s) => is_file(LUNARNAV_ROOT . '/data/pgda/' . $s['id'] . '.json')));
    $year = (int) gmdate('Y', Tools::parseDate($start));
    $pc = LunarNav\Reference\PgdaComparison::run($app->scenarios, $app->terrain, $ref, $refSites, $year);
    $app->scenarios->configureDsn(true);
    $list = implode(' · ', array_map(static fn($r) => sprintf('%s %+.1f', $r['site'], $r['delta_points']['sun']), $pc['rows']));
    $checks[] = [
        'id' => 'pgda_reference',
        'key' => 'pgda',
        'params' => ['year' => (string) $year, 'same' => $pc['ranking']['same'] ? 'yes' : 'no', 'max40' => sprintf('%.1f', $pc['max_abs_delta_sun_dem40']), 'list' => $list],
        'name' => 'Independent check vs NASA PGDA',
        'status' => $pc['status'],
        'result' => sprintf('our %d (first limb) vs PGDA 18.6-yr: Sun ranking same: %s; max |Δ Sun| at 40 m DEM sites %.1f points; Δ Sun per site: %s', $year, $pc['ranking']['same'] ? 'yes' : 'no', $pc['max_abs_delta_sun_dem40'], $list),
        'detail' => $pc,
    ];
} catch (Throwable $ex) {
    $checks[] = ['id' => 'pgda_reference', 'key' => 'pgda', 'params' => [], 'name' => 'Independent check vs NASA PGDA', 'status' => 'error', 'result' => $ex->getMessage()];
}

// 11. DEM resolution sensitivity (informative): the default Shackleton scenario with the same
// method and the horizon mask built from LOLA LDEM_75S_60M (data/terrain-dem60) instead of
// LDEM_80S_40M. Reproduce the 60 m mask with preprocess/build_site_assets.py (see README, Terrain).
try {
    $dem60Dir = LUNARNAV_ROOT . '/data/terrain-dem60';
    $cfg60 = lunarnav_config();
    $cfg60['terrain']['path'] = $dem60Dir;
    $app60 = new LunarNav\App($cfg60);
    $q = ['site' => 'shackleton_ridge', 'start' => $start, 'days' => (string) $days, 'mode' => 'terrain'];
    $r40 = $app->handle('GET', '/metrics', $q, []);
    $m40 = $r40['metrics'];
    $r60 = $app60->handle('GET', '/metrics', $q, []);
    if (($r60['provenance']['horizon']['terrain'] ?? '') !== 'applied') {
        throw new RuntimeException('60 m mask not applied (missing ' . $dem60Dir . '/shackleton_ridge/mask.json?)');
    }
    $m60 = $r60['metrics'];
    $mask60 = $r60['provenance']['horizon']['mask'] ?? [];
    $p = [
        'site' => 'shackleton_ridge',
        'sun40' => sprintf('%.1f', 100 * $m40['sun']['fraction']), 'sun60' => sprintf('%.1f', 100 * $m60['sun']['fraction']),
        'delta' => sprintf('%.1f', 100 * ($m60['sun']['fraction'] - $m40['sun']['fraction'])),
        'earth40' => sprintf('%.1f', 100 * $m40['earth']['fraction']), 'earth60' => sprintf('%.1f', 100 * $m60['earth']['fraction']),
    ];
    $checks[] = [
        'id' => 'dem_resolution_shackleton_ridge',
        'key' => 'dem_resolution',
        'params' => $p,
        'name' => 'DEM resolution sensitivity, shackleton_ridge',
        'status' => 'informative',
        'result' => sprintf('Sun (disc centre) %s%% with LOLA 40 m/px vs %s%% with 60 m/px (%s points); Earth %s%% vs %s%%', $p['sun40'], $p['sun60'], $p['delta'], $p['earth40'], $p['earth60']),
        'detail' => [
            'dem40' => ['product' => $r40['provenance']['horizon']['mask']['product'] ?? null, 'sun' => $m40['sun']['fraction'], 'sun_disc' => $m40['sun']['disc_range'], 'earth' => $m40['earth']['fraction']],
            'dem60' => ['product' => $mask60['product'] ?? null, 'sun' => $m60['sun']['fraction'], 'sun_disc' => $m60['sun']['disc_range'], 'earth' => $m60['earth']['fraction']],
            'method' => 'same ephemerides, 150 km great-circle rays every 0.5°, observer 2 m; only the DEM differs',
        ],
    ];
} catch (Throwable $ex) {
    $checks[] = ['id' => 'dem_resolution_shackleton_ridge', 'key' => 'dem_resolution', 'params' => ['site' => 'shackleton_ridge'], 'name' => 'DEM resolution sensitivity, shackleton_ridge', 'status' => 'error', 'result' => $ex->getMessage()];
}

$out = ['status' => 'run', 'generated_at' => gmdate('c'), 'method_version' => LUNARNAV_METHOD_VERSION, 'period' => ['start' => $start, 'days' => $days], 'checks' => $checks];
file_put_contents(LUNARNAV_ROOT . '/data/validation.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
foreach ($checks as $c) {
    printf("%-34s %-22s %s\n", $c['name'], $c['status'], $c['result']);
}
echo "Wrote data/validation.json\n";
