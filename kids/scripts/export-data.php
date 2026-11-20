<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Lunar Nav Kids — data export (read-only).
 *
 * Reads the main Lunar Nav API's results for the default scenario (terrain horizon, 30 days from
 * 1 July 2030) through the API's own code, from its cache only, and writes kids/src/data/kids-data.json:
 * raw values (as the API gives them), child-friendly rounded values, and light samples for the
 * animations. Run through kids/scripts/export-data (Docker, no network, a temporary copy of the
 * cache, the main project mounted read-only). Every number is checked against the API here: if a
 * check fails, nothing is written.
 *
 *   php export-data.php <main-project-root> <output-json>
 */

[$root, $outFile] = [$argv[1] ?? '/app', $argv[2] ?? '/out/kids-data.json'];
require $root . '/api/src/bootstrap.php';

const SITES = ['shackleton_ridge', 'im2_athena', 'malapert_m1'];
const SCENARIO = ['start' => '2030-07-01', 'days' => 30, 'mode' => 'terrain'];
const SAMPLE_H = 3;      // one animation sample every 3 hours (241 per site)
const SKY_STEP = 2.0;    // skyline every 2 degrees of azimuth (180 points)
const PHONE_WH = 15.0;   // a typical phone battery, for the "as much energy as N phones" comparison

$app = new LunarNav\App(lunarnav_config());
$fail = [];
$check = static function (bool $ok, string $what) use (&$fail): void {
    if (!$ok) {
        $fail[] = $what;
    }
};

/** Total hours covered by [[t0, t1], …] spans. */
$spanHours = static fn(array $spans): float => array_sum(array_map(static fn($s) => ($s[1] - $s[0]) / 3600, $spans));
/** True when t is inside one of the spans. */
$inSpans = static function (array $spans, int $t): bool {
    foreach ($spans as [$a, $b]) {
        if ($t >= $a && $t < $b) {
            return true;
        }
    }
    return false;
};
/** Linear interpolation of an hourly [t, az, el] series at time t (azimuth unwrapped). */
$at = static function (array $rows, int $t): array {
    $n = count($rows);
    for ($i = 1; $i < $n; $i++) {
        if ($rows[$i][0] >= $t) {
            [$t0, $a0, $e0] = $rows[$i - 1];
            [$t1, $a1, $e1] = $rows[$i];
            $f = $t1 > $t0 ? ($t - $t0) / ($t1 - $t0) : 0;
            $da = $a1 - $a0;
            if ($da > 180) $da -= 360;
            if ($da < -180) $da += 360;
            return [fmod(fmod($a0 + $f * $da, 360) + 360, 360), $e0 + $f * ($e1 - $e0)];
        }
    }
    return [$rows[$n - 1][1], $rows[$n - 1][2]];
};
$r1 = static fn(float $v): float => round($v, 1);
$r2 = static fn(float $v): float => round($v, 2);
/** Nearest half (14.47 → 14.5); for a lower bound, round down to the half below (16.83 → 16.5). */
$half = static fn(float $v, bool $lowerBound = false): float => $lowerBound ? floor($v * 2) / 2 : round($v * 2) / 2;

$out = [
    'about' => [
        'scenario' => 'Lunar Nav default scenario: 30 days from 1 July 2030 (UTC), terrain horizon (NASA LOLA), disc centre',
        'sources' => [
            'NASA/JPL Horizons (DE441 ephemerides): where the Sun and Earth are in the sky',
            'NASA LOLA (LRO Lunar Orbiter Laser Altimeter) terrain: the mountains on the horizon',
            'NASA Deep Space Network (DSS-14 Goldstone, DSS-43 Canberra, DSS-63 Madrid; DSN 810-005, module 301): antennas that can see the Moon',
        ],
        'computed_by' => 'Lunar Nav API (main project), read from its cache by kids/scripts/export-data — no network',
        'api_method_version' => LUNARNAV_METHOD_VERSION,
        'period' => null,
        'power_model' => null,
        'phone_battery_wh' => PHONE_WH,
        'phone_battery_note' => 'Comparison only: a typical smartphone battery holds about 15 Wh.',
    ],
    'sites' => [],
];

foreach (SITES as $id) {
    $r = $app->handle('GET', '/metrics', ['site' => $id, 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode'], 'series' => '1', 'spread' => '1'], []);
    $m = $r['metrics'];
    $p = $m['power'];
    $check(($r['provenance']['horizon']['terrain'] ?? '') === 'applied', "$id: terrain horizon applied");
    $period = $m['period'];
    $out['about']['period'] = ['start_utc' => gmdate('Y-m-d H:i', $period['start']), 'end_utc' => gmdate('Y-m-d H:i', $period['end']), 'hours' => $period['hours']];
    $out['about']['power_model'] = $p['params'] + ['battery_rule' => 'battery = survival load × longest night / depth of discharge'];

    // Checks: the spans the animations use add up to the API's own totals.
    $sunH = $spanHours($m['sun']['spans']);
    $earthH = $spanHours($m['earth']['spans']);
    $callH = $spanHours($m['comm']['spans']);
    $check(abs($sunH - $m['sun']['hours']) < 0.05, "$id: Sun spans = Sun hours ({$sunH} vs {$m['sun']['hours']})");
    $check(abs($earthH - $m['earth']['hours']) < 0.05, "$id: Earth spans = Earth hours");
    $check(abs($callH - $m['comm']['hours']) < 0.05, "$id: contact spans = contact hours");
    $check(abs($p['battery_kwh'] - $p['params']['survival_w'] * $p['longest_night_h'] / $p['params']['dod'] / 1000) < 0.01, "$id: battery = survival × night / DoD");
    // Position spread (P10–P90 of the sunshine within 300 m), from the same API answer.
    $ps = $r['position_spread'] ?? [];
    $check(!empty($ps['available']) && isset($ps['sun']['p10'], $ps['sun']['p90']) && $ps['sun']['p10'] <= $ps['sun']['p90'], "$id: ±300 m spread available (P10 ≤ P90)");
    $periodDays = $period['hours'] / 24;
    $check(abs($p['battery_wh'] - 1000 * $p['battery_kwh']) < 1, "$id: battery Wh = 1000 × kWh");

    // Light samples for the animations: every 3 h, the API's positions and the API's spans.
    $samples = [];
    for ($t = $period['start']; $t <= $period['end']; $t += SAMPLE_H * 3600) {
        [$sa, $se] = $at($r['series']['sun'], $t);
        [$ea, $ee] = $at($r['series']['earth'], $t);
        $samples[] = [
            $r2(($t - $period['start']) / 86400),              // day (0–30)
            $r1($sa), $r2($se), $inSpans($m['sun']['spans'], $t) ? 1 : 0,
            $r1($ea), $r2($ee), $inSpans($m['earth']['spans'], $t) ? 1 : 0,
            $inSpans($m['comm']['dsn_union']['spans'], $t) ? 1 : 0,
            $inSpans($m['comm']['spans'], $t) ? 1 : 0,
        ];
    }
    // Skyline (terrain horizon) every 2°, from the site's LOLA mask.
    $mask = json_decode((string) file_get_contents($root . "/api/data/terrain/{$id}/mask.json"), true);
    $step = (float) $mask['az_step_deg'];
    $sky = [];
    for ($az = 0.0; $az < 360.0; $az += SKY_STEP) {
        $sky[] = $r2((float) $mask['elevations'][(int) round($az / $step) % count($mask['elevations'])]);
    }
    $toDays = static fn(array $spans, int $s) => array_map(static fn($x) => [$r2(max(0, $x[0] - $s) / 86400), $r2(($x[1] - $s) / 86400)], $spans);

    $nightLB = (bool) $p['lower_bound'];
    $out['sites'][$id] = [
        'name' => $r['site']['name'],
        'lat' => $r['site']['lat'],
        'lon' => $r['site']['lon'],
        'raw' => [
            'sun_fraction' => $m['sun']['fraction'], 'sun_hours' => $m['sun']['hours'],
            'earth_fraction' => $m['earth']['fraction'], 'earth_hours' => $m['earth']['hours'],
            'contact_fraction' => $m['comm']['fraction'], 'contact_hours' => $m['comm']['hours'],
            'longest_no_contact_h' => $m['comm']['longest_gap_h'], 'longest_no_contact_lower_bound' => (bool) $m['comm']['longest_gap_lower_bound'],
            'longest_night_h' => $p['longest_night_h'], 'longest_night_lower_bound' => $nightLB,
            'battery_kwh' => $p['battery_kwh'], 'battery_kg' => $p['battery_kg'], 'battery_wh' => $p['battery_wh'],
            'longest_no_earth_h' => $m['earth']['longest_hidden_h'], 'longest_no_earth_lower_bound' => (bool) $m['earth']['longest_hidden_lower_bound'],
            'sun_p10_300m' => $ps['sun']['p10'] ?? null, 'sun_p90_300m' => $ps['sun']['p90'] ?? null, 'spread_radius_m' => $ps['radius_m'] ?? null,
            'sun_elevation' => $m['sun']['elevation'], 'earth_elevation' => $m['earth']['elevation'],
        ],
        'kids' => [
            'sun_days' => (int) round($m['sun']['hours'] / 24),
            'sun_percent' => (int) round(100 * $m['sun']['fraction']),
            'call_days' => (int) round($m['comm']['hours'] / 24),
            'call_percent' => (int) round(100 * $m['comm']['fraction']),
            'longest_no_call_days' => $half($m['comm']['longest_gap_h'] / 24, (bool) $m['comm']['longest_gap_lower_bound']),
            'longest_no_call_at_least' => (bool) $m['comm']['longest_gap_lower_bound'],
            'night_days' => $p['longest_night_h'] >= 24 ? $half($p['longest_night_h'] / 24, $nightLB) : null,
            'night_hours' => $p['longest_night_h'] < 24 ? (int) round($p['longest_night_h']) : null,
            'night_at_least' => $nightLB,
            'battery_kwh' => $p['battery_kwh'] >= 1 ? (int) round($p['battery_kwh']) : null,
            'battery_under_1_kwh' => $p['battery_kwh'] < 1,
            'battery_kg' => $p['battery_kg'] >= 10 ? (int) (round($p['battery_kg'] / 10) * 10) : null,
            'battery_at_least' => $nightLB,
            'sun_max_deg' => $r1($m['sun']['elevation']['max']),
            'earth_days' => (int) round($m['earth']['hours'] / 24),
            'longest_no_earth_days' => $half($m['earth']['longest_hidden_h'] / 24, (bool) $m['earth']['longest_hidden_lower_bound']),
            'longest_no_earth_at_least' => (bool) $m['earth']['longest_hidden_lower_bound'],
            'sun_days_p10_300m' => (int) round(($ps['sun']['p10'] ?? 0) * $periodDays),
            'sun_days_p90_300m' => (int) round(($ps['sun']['p90'] ?? 0) * $periodDays),
            'phone_batteries' => ($pb = $p['battery_wh'] / PHONE_WH) >= 100 ? (int) (round($pb / 100) * 100) : (int) round($pb),
        ],
        'spans' => [
            'sun' => $toDays($m['sun']['spans'], $period['start']),
            'call' => $toDays($m['comm']['spans'], $period['start']),
            'earth' => $toDays($m['earth']['spans'], $period['start']),
        ],
        'skyline' => $sky,
        'samples' => $samples,
    ];
}

// ---------- Phase 2 and 3 missions ----------

// Missions 4 and 9: the two landing dates (1 and 11 July 2030) for each site, from the API's /delay.
$out['dates'] = ['original' => '2030-07-01', 'delayed' => '2030-07-11'];
$out['plans'] = [];
foreach (SITES as $id) {
    $d = $app->handle('GET', '/delay', ['site' => $id, 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode'], 'delay_days' => '10'], []);
    $check(count($d['scenarios']) === 2 && (float) $d['delay_days'] === 10.0, "$id: delay scenarios for +10 days");
    $rows = [];
    foreach ($d['scenarios'] as $i => $sc) {
        $m = $sc['metrics'];
        $st = $m['period']['start'];
        $spans = $m['sun']['spans'];
        // Daylight before the first night: 0 h if the landing is in the dark, else time to the first sunset.
        $dayBefore = ($spans && $spans[0][0] <= $st) ? ($spans[0][1] - $st) / 3600 : 0.0;
        if ($i === 0) {
            $check(abs($m['sun']['hours'] - $out['sites'][$id]['raw']['sun_hours']) < 0.01, "$id: /delay original = /metrics (Sun hours)");
            $check(abs($m['power']['battery_kwh'] - $out['sites'][$id]['raw']['battery_kwh']) < 0.001, "$id: /delay original = /metrics (battery)");
        }
        $rows[] = [
            'date' => gmdate('Y-m-d', $st),
            'raw' => [
                'sun_fraction' => $m['sun']['fraction'], 'sun_hours' => $m['sun']['hours'],
                'daylight_before_first_night_h' => round($dayBefore, 2), 'first_sunset_after_landing_h' => $m['sun']['first_set'] ? round(($m['sun']['first_set'] - $st) / 3600, 2) : null,
                'longest_no_contact_h' => $m['comm']['longest_gap_h'], 'longest_no_contact_lower_bound' => (bool) $m['comm']['longest_gap_lower_bound'],
                'longest_night_h' => $m['power']['longest_night_h'], 'longest_night_lower_bound' => (bool) $m['power']['lower_bound'],
                'battery_kwh' => $m['power']['battery_kwh'],
            ],
            'kids' => [
                'sun_percent' => (int) round(100 * $m['sun']['fraction']),
                'daylight_before_night_days' => $dayBefore >= 24 ? (int) round($dayBefore / 24) : null,
                'daylight_before_night_hours' => $dayBefore < 24 ? (int) round($dayBefore) : null,
                'longest_no_call_days' => $half($m['comm']['longest_gap_h'] / 24, (bool) $m['comm']['longest_gap_lower_bound']),
                'battery_kwh' => $m['power']['battery_kwh'] >= 1 ? (int) round($m['power']['battery_kwh']) : null,
            ],
            'sun_spans_days' => array_map(static fn($x) => [$r2(max(0, $x[0] - $st) / 86400), $r2(($x[1] - $st) / 86400)], $spans),
        ];
    }
    $check(abs(($rows[1]['raw']['sun_hours'] - $rows[0]['raw']['sun_hours']) - $d['delta']['sun_hours']) < 0.06, "$id: delayed − original Sun hours = API delta");
    $check(abs(($rows[1]['raw']['battery_kwh'] - $rows[0]['raw']['battery_kwh']) - $d['delta']['battery_kwh']) < 0.01, "$id: delayed − original battery = API delta");
    $out['plans'][$id] = $rows;
}
$check($out['plans']['im2_athena'][0]['raw']['daylight_before_first_night_h'] == 0.0, 'IM-2, 1 July: landing in the dark (0 h of daylight)');
$check(abs($out['plans']['im2_athena'][1]['raw']['daylight_before_first_night_h'] - 250.79) < 0.01, 'IM-2, 11 July: 250.79 h of daylight before the first night');

// Missions 5 and 7: the sensitivity grids (121 points, every 100 m, ±500 m), from the API's /sensitivity.
$out['grids'] = [];
foreach (['shackleton_ridge', 'malapert_m1'] as $id) {
    $g = $app->handle('GET', '/sensitivity', ['site' => $id, 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode']], []);
    $check(!empty($g['available']) && count($g['points']) === 121 && (float) $g['spacing_m'] === 100.0, "$id: grid of 121 points every 100 m");
    $check(abs($g['summary']['sun']['p10'] - $out['sites'][$id]['raw']['sun_p10_300m']) < 1e-9 && abs($g['summary']['sun']['p90'] - $out['sites'][$id]['raw']['sun_p90_300m']) < 1e-9, "$id: grid summary within 300 m = /metrics position spread");
    $centre = array_values(array_filter($g['points'], static fn($q) => $q['dx_m'] == 0 && $q['dy_m'] == 0))[0] ?? null;
    // The grid's horizon masks are computed every 2° of azimuth (the site's own mask every 0.5°), so the
    // centre point agrees with the site to within half a percentage point, not exactly.
    $check($centre !== null && abs($centre['sun_fraction'] - $out['sites'][$id]['raw']['sun_fraction']) < 0.005, "$id: grid centre within 0.5 points of the site's Sun fraction");
    $out['grids'][$id] = [
        'spacing_m' => (int) $g['spacing_m'],
        'radius_300m' => ['sun_p10' => $g['summary']['sun']['p10'], 'sun_p90' => $g['summary']['sun']['p90'], 'points' => $g['summary']['points']],
        'centre_sun_fraction' => $centre['sun_fraction'], 'site_sun_fraction' => $out['sites'][$id]['raw']['sun_fraction'],
        'note' => 'Grid masks every 2° of azimuth; the site mask every 0.5°.',
        // [east m, north m, Sun fraction (API), Sun days of 30 (rounded)]
        'points' => array_map(static fn($q) => [(int) $q['dx_m'], (int) $q['dy_m'], $q['sun_fraction'], (int) round($q['sun_fraction'] * $periodDays)], $g['points']),
    ];
}

// Mission 6: 2030 month by month (the API's cache-only /charts/year).
$y = $app->handle('GET', '/charts/year', ['year' => '2030'], []);
$check(!empty($y['complete']), '2030 year data complete in the cache');
$out['year'] = ['year' => 2030, 'sites' => []];
foreach ($y['sites'] as $ys) {
    if (!in_array($ys['site'], SITES, true)) continue;
    $check(!empty($ys['available']) && count($ys['months']) === 12 && ($ys['horizon']['mode'] ?? $ys['mode']) === 'terrain', "{$ys['site']}: 12 months, terrain");
    $out['year']['sites'][$ys['site']] = array_map(static function ($mo) {
        $days = (int) gmdate('t', gmmktime(0, 0, 0, (int) $mo['month'], 1, 2030));
        return ['month' => $mo['month'], 'days_in_month' => $days, 'sun_fraction' => $mo['sun_fraction'], 'sun_days' => (int) round($mo['sun_fraction'] * $days)];
    }, $ys['months']);
}
$mal = $out['year']['sites']['malapert_m1'] ?? [];
$check(count($mal) === 12 && array_sum(array_map(static fn($mo) => $mo['sun_fraction'], array_slice($mal, 0, 6))) == 0.0, 'Malapert: no Sun from January to June 2030');

// Mission 7: permanent shadow within 300 m (NASA PGDA, as served by the API's long-term reference).
$out['psr'] = [];
foreach (SITES as $id) {
    $rl = $app->handle('GET', '/metrics', ['site' => $id, 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode']], [])['metrics']['reference_long_term'] ?? [];
    $file = json_decode((string) file_get_contents($root . "/api/data/pgda/{$id}.json"), true);
    $check(!empty($rl['available']) && abs($rl['psr_fraction_300m'] - $file['psr']['fraction_300m']) < 1e-9, "$id: PGDA permanent shadow within 300 m = the PGDA file");
    $out['psr'][$id] = ['fraction_300m' => $rl['psr_fraction_300m'], 'percent_300m' => (int) round(100 * $rl['psr_fraction_300m']), 'source' => $rl['source'] ?? 'NASA PGDA 69'];
}

// Mission 8: Apollo 11 (Earth always high) — the API, same scenario.
$a11 = $app->handle('GET', '/metrics', ['site' => 'apollo11', 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode']], []);
$check($a11['metrics']['earth']['fraction'] === 1.0, 'Apollo 11: Earth in view all the time');
$out['apollo11'] = [
    'name' => $a11['site']['name'], 'lat' => $a11['site']['lat'], 'lon' => $a11['site']['lon'],
    'earth_fraction' => $a11['metrics']['earth']['fraction'], 'earth_elevation' => $a11['metrics']['earth']['elevation'],
];

// Ranking by sunshine (Mission 1) — from the API fractions.
$rank = array_keys($out['sites']);
usort($rank, static fn($a, $b) => $out['sites'][$b]['raw']['sun_fraction'] <=> $out['sites'][$a]['raw']['sun_fraction']);
$out['sunniest'] = $rank;
$out['sample_fields'] = ['day', 'sun_az', 'sun_el', 'sun_up', 'earth_az', 'earth_el', 'earth_up', 'dsn_sees_moon', 'can_call'];

if ($fail) {
    fwrite(STDERR, "Checks failed — nothing written:\n  " . implode("\n  ", $fail) . "\n");
    exit(1);
}
file_put_contents($outFile, json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
foreach ($out['sites'] as $id => $s) {
    printf("%-17s sun %d days (%.1f h; 300 m P10–P90 %.4f–%.4f → %d–%d d) · Earth %d d, hidden ≤ %s d · call %d d · night %s · battery %s kWh / %s kg ≈ %d phones\n", $id, $s['kids']['sun_days'], $s['raw']['sun_hours'], $s['raw']['sun_p10_300m'], $s['raw']['sun_p90_300m'], $s['kids']['sun_days_p10_300m'], $s['kids']['sun_days_p90_300m'], $s['kids']['earth_days'], $s['kids']['longest_no_earth_days'], $s['kids']['call_days'], $s['kids']['night_days'] !== null ? $s['kids']['night_days'] . ' d' : $s['kids']['night_hours'] . ' h', $s['kids']['battery_kwh'] ?? '<1', $s['kids']['battery_kg'] ?? '<10', $s['kids']['phone_batteries']);
}
foreach ($out['plans'] as $id => $pl) printf("%-17s 1 Jul: Sun %d%%, daylight before night %.2f h, no-call ≤ %.1f h, night %.1f h%s, battery %.2f kWh | 11 Jul: Sun %d%%, daylight %.2f h, no-call %.1f h, night %.1f h%s, battery %.2f kWh\n", $id, $pl[0]['kids']['sun_percent'], $pl[0]['raw']['daylight_before_first_night_h'], $pl[0]['raw']['longest_no_contact_h'], $pl[0]['raw']['longest_night_h'], $pl[0]['raw']['longest_night_lower_bound'] ? ' (at least)' : '', $pl[0]['raw']['battery_kwh'], $pl[1]['kids']['sun_percent'], $pl[1]['raw']['daylight_before_first_night_h'], $pl[1]['raw']['longest_no_contact_h'], $pl[1]['raw']['longest_night_h'], $pl[1]['raw']['longest_night_lower_bound'] ? ' (at least)' : '', $pl[1]['raw']['battery_kwh']);
foreach ($out['year']['sites'] as $id => $ms) printf("%-17s 2030 Sun days per month: %s\n", $id, implode(' ', array_map(static fn($mo) => $mo['sun_days'], $ms)));
printf("Apollo 11 Earth %.3f–%.3f° · PSR within 300 m: %s\n", $out['apollo11']['earth_elevation']['min'], $out['apollo11']['earth_elevation']['max'], implode(', ', array_map(static fn($k, $v) => "$k {$v['percent_300m']}%", array_keys($out['psr']), $out['psr'])));
echo 'All checks passed. Wrote ', basename($outFile), ' (', filesize($outFile), " bytes)\n";
