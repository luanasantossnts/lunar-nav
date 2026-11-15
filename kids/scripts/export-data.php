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
    ],
    'sites' => [],
];

foreach (SITES as $id) {
    $r = $app->handle('GET', '/metrics', ['site' => $id, 'start' => SCENARIO['start'], 'days' => (string) SCENARIO['days'], 'mode' => SCENARIO['mode'], 'series' => '1'], []);
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
            'battery_kwh' => $p['battery_kwh'], 'battery_kg' => $p['battery_kg'],
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
        ],
        'spans' => [
            'sun' => $toDays($m['sun']['spans'], $period['start']),
            'call' => $toDays($m['comm']['spans'], $period['start']),
        ],
        'skyline' => $sky,
        'samples' => $samples,
    ];
}

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
    printf("%-17s sun %d days (%.1f h) · call %d days (%.1f h) · no-call %s d · night %s · battery %s kWh / %s kg\n", $id, $s['kids']['sun_days'], $s['raw']['sun_hours'], $s['kids']['call_days'], $s['raw']['contact_hours'], $s['kids']['longest_no_call_days'], $s['kids']['night_days'] !== null ? $s['kids']['night_days'] . ' d' : $s['kids']['night_hours'] . ' h', $s['kids']['battery_kwh'] ?? '<1', $s['kids']['battery_kg'] ?? '<10');
}
echo 'All checks passed. Wrote ', basename($outFile), ' (', filesize($outFile), " bytes)\n";
