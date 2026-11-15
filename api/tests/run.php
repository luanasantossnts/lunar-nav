<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Lunar Nav API test suite (no dependencies). Run: php tests/run.php
 * Uses FakeHorizons, a file cache in a temp folder and a synthetic terrain grid.
 */

require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/FakeHorizons.php';

use LunarNav\Agent\Analyst;
use LunarNav\Agent\Tools;
use LunarNav\App;
use LunarNav\Cache\FileCache;
use LunarNav\Geo\Frames;
use LunarNav\Horizons\HorizonsClient;
use LunarNav\Horizons\HorizonsParser;
use LunarNav\Metrics\Metrics;
use LunarNav\Metrics\Power;
use LunarNav\Metrics\Scenarios;
use LunarNav\Terrain\HorizonMask;
use LunarNav\Tests\FakeHorizons;

$failures = 0;
$count = 0;
function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $count;
    $count++;
    if ($ok) {
        echo "  ok   {$name}\n";
    } else {
        $failures++;
        echo "  FAIL {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    }
}
function near(float $a, float $b, float $tol): bool
{
    return abs($a - $b) <= $tol;
}

$tmp = sys_get_temp_dir() . '/lunarnav-tests-' . bin2hex(random_bytes(4));
mkdir($tmp . '/terrain/shackleton_ridge', 0777, true);

echo "Parser\n";
$sample = "x\n Date__(UT)__HR:MN, , , Azi_(a-app), Elev_(a-app),\n\$\$SOE\n 2030-Jul-01 00:00,*,i, 274.842783, 63.018692,\n 2030-Jul-01 06:00, , , 275.507616, -2.5,\n\$\$EOE\n";
$rows = HorizonsParser::parse($sample);
check('reads two rows', count($rows) === 2);
check('timestamp', $rows[0][0] === strtotime('2030-07-01 00:00 UTC'));
check('values', near($rows[0][1], 274.842783, 1e-9) && near($rows[1][2], -2.5, 1e-9));
$threw = false;
try { HorizonsParser::toTs('2030-07-01T00:00'); } catch (RuntimeException $e) { $threw = true; }
check('unexpected date format throws', $threw);

echo "Metrics\n";
$t0 = strtotime('2030-07-01 00:00 UTC');
$mk = static fn(array $els) => array_map(static fn($i, $e) => [$t0 + $i * 3600, 0.0, (float) $e], array_keys($els), $els);
$flat = static fn(float $az): float => 0.0;
$sp = Metrics::spans($mk([-1, 3, -3]), $flat);
check('rise interpolated to 00:15', $sp[0][0] === $t0 + 900, json_encode($sp));
check('set interpolated to 01:30', $sp[0][1] === $t0 + 5400);
$m = Metrics::body($mk([5, 5, 5]), $flat, 0.0, $t0, $t0 + 7200);
check('3 samples = 2 h, not 3', near($m['hours'], 2.0, 1e-9) && near($m['fraction'], 1.0, 1e-9));
$sun = $mk([1, -3]);   // sets at 00:15
$earth = $mk([-3, 1]); // rises at 00:45
$sc = Metrics::scenario($sun, $earth, $flat, 0, 0, $t0, $t0 + 3600);
check('overlap uses real intersection (0 h)', near($sc['both']['hours'], 0.0, 1e-9), json_encode($sc['both']));
$arc = Metrics::azimuthArc([350, 355, 5, 10]);
check('azimuth arc wraps north (20°)', near($arc['span'], 20.0, 1e-9) && near($arc['from'], 350, 1e-9));
check('margin hides low body', Metrics::spans($mk([1, 1, 1]), $flat, 2.0) === []);
check('longest gap', Metrics::longestGap([[$t0 + 3600, $t0 + 7200]], $t0, $t0 + 3 * 3600 + 1800) === 5400);

echo "Terrain mask\n";
$mask = new HorizonMask(90.0, [0.0, 10.0, 0.0, -10.0]);
check('interpolates between bins', near($mask->at(45), 5.0, 1e-9));
check('wraps at 360°', near($mask->at(315), -5.0, 1e-9));
$hidden = Metrics::spans([[$t0, 90.0, 5.0], [$t0 + 3600, 90.0, 5.0]], fn(float $az) => $mask->at($az));
check('terrain at 10° hides a body at 5°', $hidden === []);

echo "Frames\n";
[$az, $el] = Frames::vectorToAzEl(Frames::azElToVector(123.4, 5.6, -89.5, 200.0), -89.5, 200.0);
check('az/el round trip', near($az, 123.4, 1e-9) && near($el, 5.6, 1e-9));
$moved = Frames::transferSeries([[0, 0.0, 1.0]], ['lat' => -89.68, 'lon' => 196.7], ['lat' => -89.68, 'lon' => 196.7]);
$angDiff = static fn(float $x, float $y): float => abs(fmod($x - $y + 540.0, 360.0) - 180.0);
check('transfer to same site is identity', $angDiff($moved[0][1], 0.0) < 1e-9 && near($moved[0][2], 1.0, 1e-9), json_encode($moved));
[$la, $lo] = Frames::destination(0.0, 0.0, 90.0, Frames::MOON_RADIUS_KM * M_PI / 2);
check('destination quarter circle east', near($la, 0.0, 1e-6) && near($lo, 90.0, 1e-6));
$near = Frames::destination(-89.0, 10.0, 0.0, 3.0);
$tilt = Frames::transferSeries([[0, 180.0, 1.0]], ['lat' => -89.0, 'lon' => 10.0], ['lat' => $near[0], 'lon' => $near[1]]);
check('3 km move tilts horizon ~0.1°', abs($tilt[0][2] - 1.0) > 0.05 && abs($tilt[0][2] - 1.0) < 0.15, (string) $tilt[0][2]);

echo "Horizons client + cache\n";
$fake = new FakeHorizons();
$cache = new FileCache($tmp . '/cache');
$client = new HorizonsClient($cache, 'unused', 5, $fake);
$site = ['lat' => -89.684, 'lon' => 196.739, 'alt_km' => 0.0];
$a = $client->series(HorizonsClient::SUN, $site, $t0, $t0 + 86400, 60);
$b = $client->series(HorizonsClient::SUN, $site, $t0, $t0 + 86400, 60);
check('25 hourly rows', count($a['rows']) === 25);
check('second call served from cache', $fake->calls === 1 && $b['cached'] === true);

echo "Scenarios through the router\n";
// Synthetic terrain: a 3° wall to the south-west, and a 3x3 grid.
$wall = [];
for ($i = 0; $i < 720; $i++) {
    $az = $i * 0.5;
    $wall[] = ($az >= 200 && $az <= 250) ? 3.0 : -0.3;
}
file_put_contents($tmp . '/terrain/shackleton_ridge/mask.json', json_encode(['az_step_deg' => 0.5, 'elevations' => $wall, 'meta' => ['product' => 'synthetic test mask']]));
$points = [];
foreach ([-1, 0, 1] as $gy) {
    foreach ([-1, 0, 1] as $gx) {
        [$pl, $pn] = Frames::destination(-89.684, 196.739, 90.0, $gx);
        [$pl, $pn] = Frames::destination($pl, $pn, 0.0, $gy);
        $points[] = ['dx_m' => $gx * 1000, 'dy_m' => $gy * 1000, 'lat' => $pl, 'lon' => $pn, 'az_step_deg' => 0.5, 'elevations' => array_map(static fn($v) => $v + 0.4 * $gx, $wall)];
    }
}
file_put_contents($tmp . '/terrain/shackleton_ridge/grid.json', json_encode(['spacing_m' => 1000, 'az_step_deg' => 0.5, 'points' => $points]));

$config = require __DIR__ . '/../config.example.php';
$config['cache'] = ['driver' => 'file', 'path' => $tmp . '/cache2'];
$config['terrain'] = ['path' => $tmp . '/terrain'];
$fake2 = new FakeHorizons();
$app = new App($config, new HorizonsClient(new FileCache($tmp . '/cache2'), 'unused', 5, $fake2));

$r = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30'], []);
check('metrics: period 720 h', near($r['metrics']['period']['hours'], 720, 1e-9));
check('metrics: geometric by default', $r['provenance']['horizon']['mode'] === 'geometric');
$rt = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'terrain'], []);
check('terrain mode applied when mask exists', $rt['provenance']['horizon']['mode'] === 'terrain');
check('terrain reduces sunlight', $rt['metrics']['sun']['hours'] < $r['metrics']['sun']['hours'], $rt['metrics']['sun']['hours'] . ' vs ' . $r['metrics']['sun']['hours']);
$ru = $app->handle('GET', '/metrics', ['site' => 'im2_athena', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'terrain'], []);
check('missing terrain is explicit, never silent', $ru['provenance']['horizon']['terrain'] === 'unavailable for this site');

$d = $app->handle('GET', '/delay', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '14', 'delay_days' => '10'], []);
check('delay: two scenarios + delta', count($d['scenarios']) === 2 && isset($d['delta']['sun_hours']));
check('delay: shifted start', $d['scenarios'][1]['metrics']['period']['start'] - $d['scenarios'][0]['metrics']['period']['start'] === 864000);

$c = $app->handle('POST', '/compare', [], ['scenarios' => [['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30], ['site' => 'im2_athena', 'start' => '2030-07-01', 'days' => 30]]]);
check('compare: two results with summary', count($c['scenarios']) === 2 && isset($c['summary']['sun']['values']));

$w = $app->handle('GET', '/windows', ['site' => 'shackleton_ridge', 'from' => '2030-07-01', 'to' => '2030-07-20', 'duration_days' => '7', 'min_sun_fraction' => '0.9'], []);
check('windows: scanned 20 dates', count($w['scanned']) === 20);
$allMeet = array_reduce($w['matches'], static fn($ok, $m) => $ok && $m['sun_fraction'] >= 0.9, true);
check('windows: every match meets the constraint', $allMeet);

$s = $app->handle('GET', '/sensitivity', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30'], []);
check('sensitivity: 9 points', $s['available'] === true && count($s['points']) === 9);
$sunByDx = [];
foreach ($s['points'] as $p) $sunByDx[$p['dx_m']][] = $p['sun_fraction'];
check('sensitivity: higher skyline east → less sun', array_sum($sunByDx[1000]) < array_sum($sunByDx[-1000]));

echo "Uncertainty ranges\n";
$ordered = true;
$centreSame = true;
foreach ([$r, $rt] as $res) {
    foreach (['sun', 'earth', 'both'] as $b) {
        $dr = $res['metrics'][$b]['disc_range'];
        $ordered = $ordered && $dr['first_limb']['fraction'] >= $dr['centre']['fraction'] && $dr['centre']['fraction'] >= $dr['full_disc']['fraction']
            && $dr['first_limb']['hours'] >= $dr['centre']['hours'] && $dr['centre']['hours'] >= $dr['full_disc']['hours'];
        $centreSame = $centreSame && $dr['centre']['fraction'] === $res['metrics'][$b]['fraction'] && $dr['centre']['hours'] === $res['metrics'][$b]['hours'];
    }
}
check('disc range: first limb ≥ centre ≥ full disc (Sun, Earth, both)', $ordered);
check('disc range: centre equals the current value', $centreSame);
$drs = $rt['metrics']['sun']['disc_range'];
check('disc range: Sun radius 0.267°, Earth 0.95°', $drs['radius_deg'] === 0.267 && $rt['metrics']['earth']['disc_range']['radius_deg'] === 0.95);
check('disc range: Sun first limb differs from full disc near the pole', $drs['first_limb']['fraction'] > $drs['full_disc']['fraction'], json_encode($drs));
check('provenance explains the range', str_contains($rt['provenance']['visibility'], 'first limb') && str_contains($rt['provenance']['visibility'], 'full disc'));
$m1 = Metrics::discRange($mk([0.2, 0.2]), $mk([5, 5]), $flat, 0.0, 0.0, $t0, $t0 + 3600, Metrics::scenario($mk([0.2, 0.2]), $mk([5, 5]), $flat, 0.0, 0.0, $t0, $t0 + 3600));
check('disc range: Sun at 0.2° is up by centre, not as a full disc', $m1['sun']['centre']['fraction'] === 1.0 && $m1['sun']['full_disc']['fraction'] === 0.0 && $m1['sun']['first_limb']['fraction'] === 1.0);
check('percentile: linear interpolation', near(Metrics::percentile([0, 10, 20, 30, 40], 10), 4.0, 1e-9) && near(Metrics::percentile([3, 1, 2], 50), 2.0, 1e-9) && near(Metrics::percentile([7], 90), 7.0, 1e-9));

check('sensitivity: summary within 300 m', $s['summary']['available'] === true && $s['summary']['radius_m'] === 300.0);
// Synthetic grid spacing is 1000 m, so only the centre point lies within 300 m.
$centrePt = array_values(array_filter($s['points'], static fn($p) => $p['dx_m'] === 0 && $p['dy_m'] === 0))[0];
check('sensitivity: summary uses only points within the radius', $s['summary']['points'] === 1 && $s['summary']['sun']['p10'] === $centrePt['sun_fraction'] && $s['summary']['sun']['p90'] === $centrePt['sun_fraction']);
$sum = Scenarios::spreadSummary([
    ['dx_m' => 0, 'dy_m' => 0, 'sun_fraction' => 0.5, 'earth_fraction' => 0.1, 'both_fraction' => 0.1],
    ['dx_m' => 200, 'dy_m' => 200, 'sun_fraction' => 0.9, 'earth_fraction' => 0.2, 'both_fraction' => 0.2], // 283 m: inside
    ['dx_m' => 300, 'dy_m' => 100, 'sun_fraction' => 0.0, 'earth_fraction' => 0.3, 'both_fraction' => 0.0], // 316 m: outside
], 100.0);
check('spread: euclidean radius (283 m in, 316 m out)', $sum['points'] === 2 && near($sum['sun']['median'], 0.7, 1e-9), json_encode($sum));

$callsBefore = $fake2->calls;
$rs = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'terrain', 'spread' => '1'], []);
check('metrics spread=1: position_spread from the grid', ($rs['position_spread']['available'] ?? false) === true && $rs['position_spread']['points'] === 1);
check('spread adds no Horizons requests', $fake2->calls === $callsBefore, ($fake2->calls - $callsBefore) . ' extra');
$hitKey = 'spread:v5:' . json_encode(['shackleton_ridge', strtotime('2030-07-01 UTC'), 30, 60, 0.0, 0.0, 300.0, $app->terrain->gridVersion('shackleton_ridge'), [10.0, 60], Power::DEFAULTS, 15]);
check('spread cached under its own key', ($app->cache->get($hitKey)['available'] ?? null) === true);
$rn = $app->handle('GET', '/metrics', ['site' => 'im2_athena', 'start' => '2030-07-01', 'days' => '30', 'spread' => '1'], []);
check('spread without a grid is explicit', $rn['position_spread']['available'] === false && $rn['position_spread']['reason'] !== '');
check('no position_spread unless asked', !isset($r['position_spread']));

echo "DSN contact\n";
check('union merges overlaps and touching spans', Metrics::union([[[0, 10], [20, 30]], [[5, 15], [31, 40]], [[50, 60]]]) === [[0, 15], [20, 40], [50, 60]]);
check('union of nothing is empty', Metrics::union([[], []]) === []);
check('intersect keeps only common time', Metrics::intersect([[0, 100]], [[10, 20], [90, 120]]) === [[10, 20], [90, 100]]);
check('longest gap counts the edges of the period', Metrics::longestGap([[10, 20], [50, 60]], 0, 100) === 40 && Metrics::longestGap([], 0, 100) === 100);
$cm = Metrics::comm([[0, 50]], [[0, 60]], [[10, 40]], ['A' => [[0, 20]], 'B' => [[15, 30], [70, 90]]], 0, 100);
check('comm = Earth ∩ (station union)', $cm['spans'] === [[0, 30]] && $cm['fraction'] === 0.3, json_encode($cm['spans']));
check('comm: union, per station, gap and disc range', $cm['dsn_union']['spans'] === [[0, 30], [70, 90]] && $cm['stations']['B']['fraction'] === 0.35
    && near($cm['longest_gap_h'], 70 / 3600, 0.01) && $cm['disc_range']['first_limb']['fraction'] === 0.3 && $cm['disc_range']['full_disc']['fraction'] === 0.2, json_encode($cm['disc_range']));

$fake3 = new FakeHorizons();
$app3 = new App($config, new HorizonsClient(new FileCache($tmp . '/cache3'), 'unused', 5, $fake3));
$q30 = ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30'];
$rc = $app3->handle('GET', '/metrics', $q30 + ['mode' => 'terrain'], []);
$c = $rc['metrics']['comm'] ?? null;
check('metrics.comm on by default', $c !== null && count($c['stations']) === 3 && isset($c['stations']['DSS-14'], $c['stations']['DSS-43'], $c['stations']['DSS-63']));
check('comm ≤ Earth in view and ≤ DSN union', $c['fraction'] <= $rc['metrics']['earth']['fraction'] && $c['fraction'] <= $c['dsn_union']['fraction']);
$inside = true;
foreach ($c['spans'] as [$s, $e]) {
    $inside = $inside && Metrics::totalSeconds(Metrics::intersect([[$s, $e]], $rc['metrics']['earth']['spans'])) === $e - $s;
}
check('every comm span lies inside an Earth-in-view span', $inside);
check('comm fields', isset($c['hours'], $c['hours_per_day'], $c['longest_gap_h'], $c['spans']) && $c['longest_gap_h'] >= 0);
$cd = $c['disc_range'];
check('comm disc range ordered and centred', $cd['first_limb']['fraction'] >= $cd['centre']['fraction'] && $cd['centre']['fraction'] >= $cd['full_disc']['fraction'] && $cd['centre']['fraction'] === $c['fraction'] && $cd['radius_deg'] === 0.95);
$pd = $rc['provenance']['dsn'];
check('provenance names stations, source, minimum elevation and step', $pd['enabled'] === true && count($pd['stations']) === 3 && str_contains($pd['coordinates_url'], '810-005') && $pd['min_elevation_deg'] === 10.0 && $pd['step_minutes'] === 60);
$calls = $fake3->calls;
$app3->handle('GET', '/metrics', $q30, []);
check('station series served from cache on the next request', $fake3->calls === $calls, ($fake3->calls - $calls) . ' extra');
$off = $app3->handle('GET', '/metrics', $q30 + ['dsn' => '0'], []);
check('dsn=0 turns contact off, explicitly', !isset($off['metrics']['comm']) && $off['provenance']['dsn']['enabled'] === false);
$lo = $app3->handle('GET', '/metrics', $q30 + ['dsn_min_el' => '0'], []);
$hi = $app3->handle('GET', '/metrics', $q30 + ['dsn_min_el' => '20'], []);
check('lower minimum elevation → more DSN coverage', $lo['metrics']['comm']['dsn_union']['fraction'] >= $c['dsn_union']['fraction'] && $c['dsn_union']['fraction'] >= $hi['metrics']['comm']['dsn_union']['fraction'] && $lo['provenance']['dsn']['min_elevation_deg'] === 0.0);
$cl = $app3->handle('GET', '/metrics', $q30 + ['dsn_min_el' => '45'], []);
check('dsn_min_el clamped to 0–20', $cl['provenance']['dsn']['min_elevation_deg'] === 20.0);
$dl = $app3->handle('GET', '/delay', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '14', 'delay_days' => '10'], []);
check('delay reports the change in contact hours', isset($dl['delta']['comm_hours']) && near($dl['delta']['comm_hours'], $dl['scenarios'][1]['metrics']['comm']['hours'] - $dl['scenarios'][0]['metrics']['comm']['hours'], 0.011));
$cp = $app3->handle('POST', '/compare', [], ['scenarios' => [['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30], ['site' => 'im2_athena', 'start' => '2030-07-01', 'days' => 30]]]);
check('compare summary includes contact', isset($cp['summary']['comm']['values']) && count($cp['summary']['comm']['values']) === 2);
$wq = ['site' => 'shackleton_ridge', 'from' => '2030-07-01', 'to' => '2030-07-20', 'duration_days' => '7'];
$wc = $app3->handle('GET', '/windows', $wq + ['min_comm_hours_per_day' => '6'], []);
$okc = array_reduce($wc['matches'], static fn($ok, $m) => $ok && $m['comm_hours_per_day'] >= 6, true);
check('windows: min_comm_hours_per_day respected', $okc && isset($wc['scanned'][0]['comm_hours_per_day']));
$wErr = '';
try { $app3->handle('GET', '/windows', $wq + ['min_comm_hours_per_day' => '6', 'dsn' => '0'], []); } catch (InvalidArgumentException $e) { $wErr = $e->getMessage(); }
check('windows: contact constraint without DSN is rejected', str_contains($wErr, 'dsn=1'));
$sc = $app3->handle('GET', '/sensitivity', $q30, []);
check('sensitivity: contact per point and in the summary', isset($sc['points'][0]['comm_fraction'], $sc['summary']['comm']['p10']));
$cov = $app3->scenarios->dsnCoverage(strtotime('2030-07-01 UTC'), strtotime('2030-07-31 UTC'), 60);
check('dsnCoverage: union between best station and 1', $cov['union'] >= max($cov['stations']) && $cov['union'] <= 1.0);
$tc = (new Tools($app3->sites, $app3->scenarios))->execute('site_metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30]);
check('tool summary has compact comm (no spans)', isset($tc['comm']['fraction'], $tc['comm']['longest_gap_h'], $tc['comm']['stations']['DSS-43']) && !isset($tc['comm']['spans']));
check('prompt asks to cite contact for communication questions', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14'), 'cite comm'));

echo "Power and battery\n";
$below = static fn(float $az): float => -1.0; // skyline at −1°, so a Sun at 0° counts as visible
$p400 = Power::params([]);
$b0 = Power::budget($mk([0, 0, 0]), $below, 0.0, $t0, $t0 + 7200, $p400);
check('Sun fixed at 0°, vertical panel: energy = P × hours', near($b0['energy_wh'], 400 * 2, 1e-6), (string) $b0['energy_wh']);
$bh = Power::budget($mk([0, 0, 0]), $below, 0.0, $t0, $t0 + 7200, Power::params(['orientation' => 'horizontal']));
check('Sun fixed at 0°, horizontal panel: energy ≈ 0', abs($bh['energy_wh']) < 1e-6);
$bn = Power::budget($mk([-5, -5, 5, 5]), $flat, 0.0, $t0, $t0 + 3 * 3600, $p400); // sunrise at 01:30
check('battery = survival load × longest night / DoD', near($bn['longest_night_h'], 1.5, 1e-9) && near($bn['battery_wh'], 60 * 1.5 / 0.8, 1e-6) && near(Power::batteryWh(60, 100, 0.8), 7500, 1e-9));
check('battery mass = capacity / Wh per kg', near($bn['battery_kg'], round(60 * 1.5 / 0.8 / 150, 2), 1e-9));
check('balance = energy per day − load × 24 h', near($b0['balance_wh_per_day'], round(800 / (2 / 24) - 150 * 24, 1), 0.05));
check('no deficit when the panel covers the load', $b0['deficit_fraction'] === 0.0 && Power::budget($mk([0, 0, 0]), $below, 0.0, $t0, $t0 + 7200, Power::params(['load_w' => 500]))['deficit_fraction'] === 1.0);
$pc = Power::params(['dod' => 5, 'orientation' => 'sideways', 'panel_w' => -3, 'wh_per_kg' => 'x']);
check('inputs validated: clamped, unknown orientation → default', $pc['dod'] === 1.0 && $pc['orientation'] === 'vertical_tracking' && $pc['panel_w'] === 1.0 && $pc['wh_per_kg'] === 150.0);
$pr = $rt['metrics']['power'];
$d1 = $pr['disc_range'];
check('power ranges ordered: first limb ≥ centre ≥ full disc (energy); nights and batteries the other way',
    $d1['first_limb']['energy_wh_per_day'] >= $d1['centre']['energy_wh_per_day'] && $d1['centre']['energy_wh_per_day'] >= $d1['full_disc']['energy_wh_per_day']
    && $d1['first_limb']['longest_night_h'] <= $d1['centre']['longest_night_h'] && $d1['centre']['longest_night_h'] <= $d1['full_disc']['longest_night_h']
    && $d1['first_limb']['battery_kwh'] <= $d1['centre']['battery_kwh'] && $d1['centre']['battery_kwh'] <= $d1['full_disc']['battery_kwh'], json_encode($d1));
check('API energy = P × panel_factor × hours', abs($pr['energy_wh'] - 400 * $rt['metrics']['sun']['panel_factor']['vertical'] * $rt['metrics']['period']['hours']) <= 0.001 * max(1, $pr['energy_wh']) + 0.2);
check('power night = Sun longest dark period', near($pr['longest_night_h'], $rt['metrics']['sun']['longest_hidden_h'], 0.011));
$r800 = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'terrain', 'pw_panel_w' => '800'], []);
check('pw_panel_w doubles the energy, not the battery', near($r800['metrics']['power']['energy_wh'], 2 * $pr['energy_wh'], 0.2) && $r800['metrics']['power']['battery_kwh'] === $pr['battery_kwh']);
check('power provenance lists inputs and assumptions', $r800['provenance']['power']['params']['panel_w'] === 800.0 && count($r800['provenance']['power']['assumptions']) >= 4 && str_contains(implode(' ', $r800['provenance']['power']['assumptions']), '1 AU'));
$dp = $app->handle('GET', '/delay', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '14', 'delay_days' => '10'], []);
check('delay reports the change in battery', isset($dp['delta']['battery_kwh']) && near($dp['delta']['battery_kwh'], $dp['scenarios'][1]['metrics']['power']['battery_kwh'] - $dp['scenarios'][0]['metrics']['power']['battery_kwh'], 0.0011));
$wb = $app->handle('GET', '/windows', ['site' => 'shackleton_ridge', 'from' => '2030-07-01', 'to' => '2030-07-20', 'duration_days' => '7', 'max_battery_kwh' => '1.5'], []);
check('windows: max_battery_kwh respected', array_reduce($wb['matches'], static fn($ok, $m) => $ok && $m['battery_kwh'] <= 1.5, true) && isset($wb['scanned'][0]['battery_kwh']));
$sp = $app->handle('GET', '/sensitivity', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30'], []);
check('sensitivity: energy, night and battery per point and in the summary', isset($sp['points'][0]['energy_wh_per_day'], $sp['points'][0]['longest_night_h'], $sp['summary']['energy_wh_per_day']['p10'], $sp['summary']['longest_night_h']['p90'], $sp['summary']['battery_kwh']['median']));

echo "Lower bounds (night or gap touching the period edges)\n";
check('gap after the last span is a lower bound', Metrics::longestGapInfo([[10, 20], [50, 60]], 0, 100) === [40, true]);
check('interior gap is exact', Metrics::longestGapInfo([[0, 10], [60, 100]], 0, 100) === [50, false]);
check('gap before the first span is a lower bound', Metrics::longestGapInfo([[70, 100]], 0, 100) === [70, true]);
check('tie between an interior and an edge gap counts as a bound', Metrics::longestGapInfo([[30, 40], [70, 100]], 0, 100) === [30, true]);
check('no gap → not a bound', Metrics::longestGapInfo([[0, 100]], 0, 100) === [0, false]);
$bodyAtStart = Metrics::body($mk([-5, -5, 5, 5]), $flat, 0.0, $t0, $t0 + 3 * 3600);
$bodyInside = Metrics::body($mk([5, -5, -5, 5, 5]), $flat, 0.0, $t0, $t0 + 4 * 3600);
check('body: longest_hidden_lower_bound true at the start, false inside', $bodyAtStart['longest_hidden_lower_bound'] === true && $bodyInside['longest_hidden_lower_bound'] === false);
$bnA = Power::budget($mk([-5, -5, 5, 5]), $flat, 0.0, $t0, $t0 + 3 * 3600, $p400);
$bnB = Power::budget($mk([5, -5, -5, 5, 5]), $flat, 0.0, $t0, $t0 + 4 * 3600, $p400);
check('power: night, battery and mass flagged as minimums when the night touches the period', $bnA['lower_bound'] === true && $bnB['lower_bound'] === false);
$pb = Metrics::percentileBound([1, 2, 3, 10], [false, false, false, true], 90);
check('percentileBound: flag follows the points used', near($pb[0], 7.9, 1e-9) && $pb[1] === true && Metrics::percentileBound([1, 2, 3, 10], [false, false, false, true], 10)[1] === false);
$grid = [];
foreach ([[0, 0, 100, false], [100, 0, 200, false], [0, 100, 300, false], [-100, 0, 720, true], [0, -100, 720, true]] as [$dx, $dy, $n, $lb]) {
    $grid[] = ['dx_m' => $dx, 'dy_m' => $dy, 'sun_fraction' => 0.5, 'earth_fraction' => 0.5, 'both_fraction' => 0.5, 'energy_wh_per_day' => 1000, 'longest_night_h' => $n, 'battery_kwh' => $n * 0.075, 'night_lower_bound' => $lb];
}
$gs = Scenarios::spreadSummary($grid, 100.0);
check('spread: P90 of night and battery flagged when it uses a bounded point, P10 not', $gs['longest_night_h']['lower_bound']['p90'] === true && $gs['longest_night_h']['lower_bound']['p10'] === false && $gs['battery_kwh']['lower_bound']['p90'] === true);
$lbR = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'terrain'], []);
check('API carries the flags (Sun, Earth, power and its disc range)', is_bool($lbR['metrics']['sun']['longest_hidden_lower_bound']) && is_bool($lbR['metrics']['earth']['longest_hidden_lower_bound'])
    && is_bool($lbR['metrics']['power']['lower_bound']) && is_bool($lbR['metrics']['power']['disc_range']['full_disc']['lower_bound']));
check('contact gap carries the flag', is_bool($rc['metrics']['comm']['longest_gap_lower_bound']));
check('grid points and windows rows carry the flags', isset($sp['points'][0]['night_lower_bound'], $wb['scanned'][0]['battery_lower_bound'], $wb['scanned'][0]['longest_dark_lower_bound']));
check('delay flags a battery change that involves a minimum', is_bool($dp['delta']['battery_from_lower_bound']));
check('prompt: lower bounds are reported as "at least"', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14'), 'at least'));
check('Learn mode adds the glossary to the prompt; technical mode does not', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14', true), 'Glossary') && str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14', true), 'Libration:')
    && !str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14'), 'Glossary (the app'));

echo "Full nights (series extended by 15 days)\n";
// Window [0, 1000], period [300, 700].
check('a night that starts before the period is measured in full', array_slice(Metrics::longestGapOverlapping([[0, 100], [400, 800]], 0, 1000, 300, 700), 0, 2) === [300, false]);
check('…which the period alone would cut short', Metrics::longestGapInfo([[300, 400], [400, 700]], 300, 700)[0] === 0 && Metrics::longestGapOverlapping([[0, 100], [400, 800]], 0, 1000, 300, 700)[0] > 100);
check('gaps that do not overlap the period are ignored', array_slice(Metrics::longestGapOverlapping([[0, 100], [250, 1000]], 0, 1000, 300, 700), 0, 2) === [0, false]);
check('lower_bound only at the edge of the extended window', array_slice(Metrics::longestGapOverlapping([[500, 1000]], 0, 1000, 300, 700), 0, 2) === [500, true] && array_slice(Metrics::longestGapOverlapping([[0, 200], [800, 1000]], 0, 1000, 300, 700), 0, 2) === [600, false]);
check('a gap ending exactly at the window edge is a bound', array_slice(Metrics::longestGapOverlapping([[0, 600]], 0, 1000, 300, 700), 0, 2) === [400, true]);
// FakeHorizons: the Sun is below 0° from about 2030-07-15 09:00 to 2030-07-23 03:00 (≈ 186 h).
$fn = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-20', 'days' => '3', 'series' => '1'], []);
$periodOnly = Metrics::longestGapInfo(Metrics::spans($fn['series']['sun'], $flat, 0.0), $fn['metrics']['period']['start'], $fn['metrics']['period']['end']);
check('API: a night straddling the period start is measured in full (> the 72 h period)', $fn['metrics']['sun']['longest_hidden_h'] > 150 && $fn['metrics']['sun']['longest_hidden_lower_bound'] === false && $fn['metrics']['sun']['fraction'] === 0.0, json_encode([$fn['metrics']['sun']['longest_hidden_h'], $periodOnly]));
check('API: the full night is ≥ the night seen within the period only', $fn['metrics']['sun']['longest_hidden_h'] >= round($periodOnly[0] / 3600, 2));
check('battery uses the full night; energy stays within the period', near($fn['metrics']['power']['battery_wh'], 60 * $fn['metrics']['power']['longest_night_h'] / 0.8, 0.2) && $fn['metrics']['power']['energy_wh'] === 0.0 && $fn['metrics']['power']['lower_bound'] === false);
check('series returned for charts cover the period only', end($fn['series']['sun'])[0] === $fn['metrics']['period']['end'] && $fn['series']['sun'][0][0] === $fn['metrics']['period']['start']);
$pl = $fn['metrics']['sun']['longest_hidden_placement'];
check('placement: a night straddling both ends is flagged (started before, ends after)', $pl['started_before_period'] === true && $pl['ends_after_period'] === true, json_encode($pl));
check('placement also on the power night', $fn['metrics']['power']['night_placement']['started_before_period'] === true);
$gp = Metrics::longestGapOverlapping([[0, 100], [400, 800]], 0, 1000, 300, 700);
check('placement: gap [100, 400] started before [300, 700] and ends inside it', Metrics::gapPlacement($gp, 300, 700) === ['started_before_period' => true, 'ends_after_period' => false]);
$tsum = Tools::summarise($fn);
check('tool summary carries the placement', isset($tsum['sun']['longest_hidden_placement']['started_before_period'], $tsum['power']['night_placement']));
$pc = Analyst::systemPrompt('en', 'technical', '2026-11-15');
check('prompt: strict [n] citations, side by side, no ranges or "see below"', str_contains($pc, 'one number per pair of brackets') && str_contains($pc, '[2][4]') && str_contains($pc, 'never write "see below"'));
check('prompt: full nights rule and placement', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-15'), 'measured in full, up to 15 days beyond the period') && str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-15'), 'started_before_period'));
check('provenance states the night window', $fn['provenance']['night_window']['extended_days'] === 15 && str_contains($fn['provenance']['night_window']['note'], 'measured in full'));

echo "Analyst: arguments do not carry over\n";
$iso = new Tools($app3->sites, $app3->scenarios);
$x1 = $iso->execute('site_metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30, 'dsn_min_elevation_deg' => 20]);
$x2 = $iso->execute('compare_sites', ['sites' => ['shackleton_ridge', 'im2_athena'], 'start' => '2030-07-01', 'days' => 30]);
check('dsn_min_elevation_deg applies to its own call only', $x1['comm']['min_elevation_deg'] === 20.0 && $x2['scenarios'][0]['comm']['min_elevation_deg'] === 10.0, json_encode([$x1['comm']['min_elevation_deg'], $x2['scenarios'][0]['comm']['min_elevation_deg']]));
$x3 = $iso->execute('power_budget', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30, 'panel_w' => 800, 'mode' => 'terrain']);
$x4 = $iso->execute('site_metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30]);
check('power inputs apply to their own call only', $x3['power']['params']['panel_w'] === 800.0 && $x4['power']['params']['panel_w'] === 400.0);
check('power_budget: compact, with ranges, inputs and the illustrative note', isset($x3['power']['battery_kwh'], $x3['power']['disc_range']['full_disc'], $x3['position_spread']['battery_kwh']) && str_contains($x3['note'], 'Illustrative') && !isset($x3['power']['spans']));
check('prompt: power values are illustrative', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14'), 'illustrative'));

echo "Sensitivity availability\n";
$na = $app->handle('GET', '/sensitivity', ['site' => 'im2_athena', 'start' => '2030-07-01', 'days' => '30'], []);
check('site without terrain: reason_code no_terrain, no script name', $na['available'] === false && $na['reason_code'] === 'no_terrain' && !preg_match('/preprocess|\.py|\.php/', $na['reason']));
$nc = $app->handle('GET', '/sensitivity', ['lat' => '-85.5', 'lon' => '30', 'start' => '2030-07-01', 'days' => '30'], []);
check('custom coordinates: reason_code custom_site', $nc['available'] === false && $nc['reason_code'] === 'custom_site');
check('sensitivity does not depend on the horizon mode', $app->handle('GET', '/sensitivity', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '30', 'mode' => 'geometric'], [])['available'] === true);
mkdir($tmp . '/terrain/malapert_m1', 0777, true);
file_put_contents($tmp . '/terrain/malapert_m1/grid.json', '{"spacing_m": 100, "points": [');   // half-written file
$bad = '';
try { $app->handle('GET', '/sensitivity', ['site' => 'malapert_m1', 'start' => '2030-07-01', 'days' => '30'], []); } catch (RuntimeException $e) { $bad = $e->getMessage(); }
check('an unreadable grid is an error, never "no terrain"', str_contains($bad, 'could not be read'), $bad);
file_put_contents($tmp . '/terrain/malapert_m1/mask.json', 'not json');
$badMask = '';
try { $app->handle('GET', '/metrics', ['site' => 'malapert_m1', 'start' => '2030-07-01', 'days' => '3', 'mode' => 'terrain'], []); } catch (RuntimeException $e) { $badMask = $e->getMessage(); }
check('an unreadable mask is an error, not a silent switch to geometric', str_contains($badMask, 'could not be read'), $badMask);

echo "Long-term reference (NASA PGDA 69)\n";
$lt = $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '3'], [])['metrics']['reference_long_term'];
$raw = json_decode((string) file_get_contents(LUNARNAV_ROOT . '/data/pgda/shackleton_ridge.json'), true);
check('metrics.reference_long_term loaded from data/pgda', $lt['available'] === true && $lt['sun_avg'] === $raw['sun']['at_site'] && $lt['earth_avg'] === $raw['earth']['at_site'] && $lt['resolution_m'] === 60);
check('reference: P10–P90 within 300 m, PSR fractions, period, source and citation', count($lt['sun_p10_p90_300m']) === 2 && isset($lt['psr_fraction_300m'], $lt['psr_fraction_1km']) && str_contains($lt['period'], '18.6') && str_contains($lt['source'], 'PGDA') && str_contains($lt['citation'], 'Icarus 211'));
check('reference: same block whatever the period (independent of the dates)', $app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-09-01', 'days' => '5'], [])['metrics']['reference_long_term'] === $lt);
$ltA = $app->handle('GET', '/metrics', ['site' => 'apollo11', 'start' => '2030-07-01', 'days' => '3'], [])['metrics']['reference_long_term'];
check('reference: a site outside 65°S–90°S says why', $ltA['available'] === false && str_contains($ltA['reason'], '65°S'));
$ltC = $app->handle('GET', '/metrics', ['lat' => '-85.5', 'lon' => '30', 'start' => '2030-07-01', 'days' => '3'], [])['metrics']['reference_long_term'];
check('reference: custom coordinates say why', $ltC['available'] === false && str_contains($ltC['reason'], 'Custom'));
check('tool summary carries the long-term reference', isset(Tools::summarise($app->handle('GET', '/metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => '3'], []))['reference_long_term']['sun_avg']));
check('prompt separates the chosen period from the long-term average', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-15'), 'long-term average (NASA PGDA)'));
$bl = LunarNav\Reference\PgdaComparison::blocks(2030);
check('comparison year: two blocks, contiguous, within the 200-day limit, covering 365 days', count($bl) === 2 && $bl[0][1] === $bl[1][0] && max(($bl[0][1] - $bl[0][0]), ($bl[1][1] - $bl[1][0])) / 86400 <= 200 && ($bl[1][1] - $bl[0][0]) / 86400 == 365);

echo "Health\n";
$h = $app->handle('GET', '/health', [], []);
check('health: Claude only, booleans only (no other providers, no usage figures)', $h['providers'] === ['claude' => false] && $h['voice'] === ['tts' => false, 'stt' => false]
    && array_keys($h) === ['ok', 'method_version', 'cache', 'providers', 'voice']);

$cust = $app->handle('GET', '/metrics', ['lat' => '-85.5', 'lon' => '30', 'start' => '2030-07-01', 'days' => '3'], []);
check('custom coordinates accepted', $cust['site']['id'] === 'custom');
$bad = false;
try { $app->handle('GET', '/metrics', ['lat' => '-95', 'lon' => '0', 'start' => '2030-07-01'], []); } catch (InvalidArgumentException $e) { $bad = true; }
check('out-of-range coordinates rejected', $bad);
$sites = $app->handle('GET', '/sites', [], []);
check('sites list with terrain availability', count($sites['sites']) >= 10 && $sites['sites'][0]['terrain']['mask'] === true);

echo "Analyst tools and prompt\n";
$tools = new Tools($app->sites, $app->scenarios);
$tm = $tools->execute('site_metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30, 'mode' => 'terrain']);
check('tool summary has no raw spans', !isset($tm['sun']['spans']) && isset($tm['sun']['fraction']));
check('tool summary states horizon model', str_starts_with($tm['horizon'], 'terrain'));
check('tool summary carries disc range and position spread', isset($tm['sun']['disc_range']['full_disc'], $tm['sun_and_earth']['disc_range'], $tm['position_spread']['sun']['p10']));
check('prompt asks for ranges, not exact centre values', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-14'), 'Never present the centre value as exact'));
$td = $tools->execute('delay_impact', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 14, 'delay_days' => 10]);
check('delay tool returns delta', isset($td['delta_hours']['sun_hours']));
check('every tool has a schema', count(array_filter(Tools::definitions(), static fn($t) => isset($t['schema']['type']))) === count(Tools::definitions()));
$p = Analyst::systemPrompt('pt', 'classroom', '2026-10-28');
check('prompt sets language and number rule', str_contains($p, 'Brazilian Portuguese') && str_contains($p, 'Never state a value'));
$routeErr = '';
try { $app->handle('POST', '/analyst', [], ['question' => 'hi']); } catch (LunarNav\Http\ApiError $e) { $routeErr = $e->errorCode; }
check('analyst without a key: a coded, polite error (no technical message)', $routeErr === 'analyst_unavailable', $routeErr);

echo "Analyst tool-use loop (scripted Claude)\n";
$scripted = new class extends LunarNav\Http\HttpClient {
    public array $sent = [];
    private int $turn = 0;
    public function postJson(string $url, array $payload, array $headers = []): array
    {
        $this->sent[] = $payload;
        $this->turn++;
        if ($this->turn === 1) {
            return ['stop_reason' => 'tool_use', 'content' => [
                ['type' => 'text', 'text' => 'Checking.'],
                ['type' => 'tool_use', 'id' => 'tu_1', 'name' => 'site_metrics', 'input' => ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30]],
            ]];
        }
        return ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => 'Sunlight is high [1].']]];
    }
};
$prov = new LunarNav\Agent\AnthropicProvider('test-key', 'claude-opus-5-5', 'https://example.invalid', 500, $scripted);
$calls = [];
$res = $prov->run('sys', [], 'Compare', Tools::definitions(), function (string $n, array $a) use (&$calls, $tools) {
    $calls[] = $n;
    return $tools->execute($n, $a);
}, 4);
check('loop ran the tool once', $calls === ['site_metrics']);
check('final text returned', $res['text'] === 'Sunlight is high [1].' && $res['steps'] === 2);
$second = $scripted->sent[1]['messages'];
$last = end($second);
check('tool_result sent back with matching id', $last['role'] === 'user' && $last['content'][0]['type'] === 'tool_result' && $last['content'][0]['tool_use_id'] === 'tu_1');
check('tools advertised with input_schema', isset($scripted->sent[0]['tools'][0]['input_schema']));
check('dates: Unix seconds accepted', \LunarNav\Agent\Tools::parseDate('1909094400') === 1909094400);
check('dates: ISO date is UTC midnight', \LunarNav\Agent\Tools::parseDate('2030-07-01') === 1909094400);

$svsCache = \LunarNav\Cache\CacheFactory::make(['cache' => ['driver' => 'file', 'path' => sys_get_temp_dir() . '/lunarnav-svs-test-' . getmypid()]]);
$svs = new \LunarNav\Svs\SvsClient($svsCache, LUNARNAV_ROOT . '/data/svs.json', 'x', static fn(int $id) => [
    'id' => $id, 'url' => "http://svs.gsfc.nasa.gov/{$id}/", 'title' => "T{$id}", 'description' => '<p>Hello &amp; <b>world</b></p>', 'release_date' => '2022-08-19T00:00:00-04:00',
    'main_image' => ['url' => "http://svs.gsfc.nasa.gov/i{$id}.jpg", 'width' => 1024, 'height' => 576, 'alt_text' => 'alt'],
]);
$l = $svs->list();
check('svs: curated items listed', count($l['items']) === 6);
$cat = json_decode((string) file_get_contents(LUNARNAV_ROOT . '/data/svs.json'), true);
$i5127 = array_values(array_filter($cat['items'], static fn($x) => $x['id'] === 5127))[0] ?? null;
check('svs: 5127 (Moon Base page flyover, confirmed via the SVS API) is in the catalogue under "sites"', $i5127 !== null && $i5127['topic'] === 'sites' && $i5127['title'] === 'Lunar South Pole Terrain in Coded Color' && $i5127['url'] === 'https://svs.gsfc.nasa.gov/5127/');
check('svs: html stripped, https forced', $l['items'][0]['summary'] === 'Hello & world' && str_starts_with($l['items'][0]['image']['url'], 'https://'));
$down = new \LunarNav\Svs\SvsClient(\LunarNav\Cache\CacheFactory::make(['cache' => ['driver' => 'file', 'path' => sys_get_temp_dir() . '/lunarnav-svs-down-' . getmypid()]]), LUNARNAV_ROOT . '/data/svs.json', 'x', static fn(int $id) => throw new RuntimeException('offline'));
$d = $down->list()['items'][0];
check('svs: falls back to curated title when offline', $d['live'] === false && $d['title'] === 'Artemis III Landing Region Candidates');

echo "Visual review: SVS text, analyst numbers\n";
// The five real SVS descriptions (as returned by the SVS API, 2026-11-15), shortened.
$svsReal = [
    5013 => "This narrated movie introduces Artemis III, reveals the mission's 13 candidate landing regions near the lunar South Pole, and briefly discusses some of the criteria that narrowed the selection to these regions.Music provided by Universal Production Music: Best Days to Come – Mattia Cupelli",
    4716 => "A visualization of Shackleton crater. The near (Earth-facing) side of the Moon is to the right. In the false-color elevation on the left, red is higher and blue is lower. || shackleton_split_final_print.jpg (1024x1024) [280.9\u{00A0}KB] || shackleton_split_final_searchweb.png (320x180) [80.1\u{00A0}KB] ||",
    4770 => "Beginning on the near side of the Moon, with the Apollo sites marked, the view quickly moves to the South Pole and zooms in to show the changing illumination conditions there for an entire year. || pole.0126_print.jpg (1024x576) [63.6\u{00A0}KB] || pole.0126_searchweb.png (320x180) [",
    4119 => "|| The data in the table for the entire year can be downloaded as a JSON file or as a text file. || moon.0001.jpg (730x730) [27.7\u{00A0}KB] || comp.0001.tif (1920x1080) [1.5\u{00A0}MB] ||",
    5228 => "An animated view of the Earth and Sun as seen from near the Moon's South Pole. || southpole_earth_sun.1858_print.jpg (1024x576) [38.5\u{00A0}KB] || southpole_earth_sun_1080p30.mp4 (1920x1080) [12\u{00A0}MB] ||",
];
$clean = array_map([\LunarNav\Svs\SvsClient::class, 'cleanSummary'], $svsReal);
$junk = static fn(?string $t) => $t !== null && (str_contains($t, '||') || preg_match('/\.(jpg|png|tif|mp4)\b|\d+x\d+|\bKB\b|\bMB\b|Music provided|downloaded/i', $t));
check('svs: no file lists, sizes, music credits or download notes in any of the 5 summaries', count(array_filter($clean, $junk)) === 0, json_encode($clean));
check('svs: 4119 has no prose left → title only', $clean[4119] === null);
check('svs: the other 4 keep their first sentence, ending in a full stop', $clean[5013] !== null && str_ends_with($clean[5013], 'to these regions.') && str_starts_with($clean[4716], 'A visualization of Shackleton crater.') && str_ends_with($clean[4770], 'entire year.') && $clean[5228] === "An animated view of the Earth and Sun as seen from near the Moon's South Pole.");

$fm = Tools::forModel($tm);
check('model sees percentages with one decimal, not fractions', !isset($fm['sun']['fraction']) && $fm['sun']['percent'] === round(100 * $tm['sun']['fraction'], 1) && $fm['sun']['disc_range']['full_disc']['percent'] === round(100 * $tm['sun']['disc_range']['full_disc']['fraction'], 1));
check('model sees the ±300 m range as P10/P90 percentages', isset($fm['position_spread']['sun']['p10_pct'], $fm['position_spread']['sun']['p90_pct']) && $fm['position_spread']['sun']['p90_pct'] === round(100 * $tm['position_spread']['sun']['p90'], 1));
$walk = static function ($v, string $k = '') use (&$walk): array {
    $bad = [];
    if (is_array($v)) { foreach ($v as $kk => $x) $bad = array_merge($bad, $walk($x, is_string($kk) ? $kk : $k)); return $bad; }
    if ((str_contains($k, 'percent') || str_ends_with($k, '_pct')) && is_float($v) && abs($v * 10 - round($v * 10)) > 1e-9) $bad[] = "$k=$v";
    if (($k === 'hours' || str_ends_with($k, '_h')) && is_float($v) && abs($v * 10 - round($v * 10)) > 1e-9) $bad[] = "$k=$v";
    if (str_contains($k, 'fraction')) $bad[] = "$k (fraction key left)";
    return $bad;
};
$badKeys = $walk($fm);
check('model-facing site_metrics: every percent and hour value has at most one decimal; no *fraction keys', $badKeys === [], implode(', ', array_slice($badKeys, 0, 5)));
$tcmp = $tools->execute('compare_sites', ['sites' => ['shackleton_ridge', 'im2_athena'], 'start' => '2030-07-01', 'days' => 30, 'mode' => 'terrain']);
check('compare_sites in terrain carries the ±300 m range for each site', isset($tcmp['scenarios'][0]['position_spread']['sun']['p10'], $tcmp['scenarios'][1]['position_spread']['available']));
$tgeo = $tools->execute('compare_sites', ['sites' => ['shackleton_ridge', 'im2_athena'], 'start' => '2030-07-01', 'days' => 30]);
check('compare_sites in geometric mode has no terrain range', !isset($tgeo['scenarios'][0]['position_spread']));
check('site_metrics in geometric mode has no terrain range', !isset($tools->execute('site_metrics', ['site' => 'shackleton_ridge', 'start' => '2030-07-01', 'days' => 30])['position_spread']));
$pp = Analyst::systemPrompt('en', 'technical', '2026-11-15');
check('prompt: percentages with one decimal, never a raw fraction; ±300 m range in terrain', str_contains($pp, 'Never write a raw fraction') && str_contains($pp, '"99.8 %"') && str_contains($pp, 'within 300 m [1]'));

echo "Degrees: two decimals for the model\n";
$fd = Tools::forModel(['sun' => ['elevation_deg' => ['min' => 0.5812, 'max' => 1.52849, 'mean' => 1.0], 'disc_range' => ['radius_deg' => 0.267]], 'azimuth' => 123.4567, 'min_elevation_deg' => 10]);
check('model sees elevations and azimuths with two decimals; the disc radius is kept', $fd['sun']['elevation_deg'] === ['min' => 0.58, 'max' => 1.53, 'mean' => 1.0] && $fd['azimuth'] === 123.46 && $fd['sun']['disc_range']['radius_deg'] === 0.267 && $fd['min_elevation_deg'] === 10.0);
check('prompt: degrees with two decimals', str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-15'), 'elevations and azimuths in degrees with two decimals') && str_contains(Analyst::systemPrompt('en', 'technical', '2026-11-15'), '"1.53°"'));
$vj = json_decode((string) file_get_contents(LUNARNAV_ROOT . '/data/validation.json'), true);
$ctl = array_values(array_filter($vj['checks'], static fn($c) => $c['id'] === 'control_apollo11'))[0];
check('validation file: control-site elevations stored with two decimals', preg_match('/^\d+\.\d{2}$/', $ctl['params']['min']) === 1 && preg_match('/^\d+\.\d{2}$/', $ctl['params']['max']) === 1);

echo "Charts: month-by-month year, cache only\n";
$cy = $app->handle('GET', '/charts/year', ['year' => '2031'], []);
check('charts/year never calls Horizons: uncached sites are reported unavailable', $cy['complete'] === false && count($cy['sites']) === 5 && !$cy['sites'][0]['available']);
$site0 = $app->sites->resolve(['site' => 'shackleton_ridge']);
$app->scenarios->configureDsn(false, null);
$yr = [];
foreach (\LunarNav\Reference\PgdaComparison::blocks(2031) as [$bs, $be]) $yr[] = $app->scenarios->run($site0, $bs, (int) round(($be - $bs) / 86400), 60, 'terrain');
$app->scenarios->configureDsn(true, null);
$cy2 = $app->handle('GET', '/charts/year', ['year' => '2031'], []);
$sh = $cy2['sites'][0];
$sunSec = 0; $tot = 0;
foreach ($sh['months'] as $mo) { $d = (int) gmdate('t', gmmktime(0, 0, 0, $mo['month'], 1, 2031)); $sunSec += $mo['sun_fraction'] * $d; $tot += $d; }
$runSun = ($yr[0]['metrics']['sun']['hours'] + $yr[1]['metrics']['sun']['hours']) / (($yr[0]['metrics']['period']['end'] - $yr[0]['metrics']['period']['start'] + $yr[1]['metrics']['period']['end'] - $yr[1]['metrics']['period']['start']) / 3600);
check('charts/year: once cached, 12 months per site', $sh['available'] && count($sh['months']) === 12);
check('charts/year: months weighted by days give the yearly Sun share of run()', abs($sunSec / $tot - $runSun) < 2e-4, sprintf('%.5f vs %.5f', $sunSec / $tot, $runSun));

echo "Cost controls: analyst cache, limits, prompt caching, TTS cache, spoken summary, STT\n";
use LunarNav\Http\ApiError;
use LunarNav\Voice\Voice;
/** Fake Claude API: one tool round, then a labelled answer; reports usage like the real API. */
$fakeClaude = new class extends LunarNav\Http\HttpClient {
    public int $calls = 0; public array $sent = []; public bool $rejectCacheControl = false;
    public function postJson(string $url, array $payload, array $headers = []): array
    {
        if ($this->rejectCacheControl && (isset($payload['cache_control']) || isset($payload['system'][0]['cache_control']))) {
            throw new RuntimeException('Upstream error 400: cache_control: Extra inputs are not permitted');
        }
        $this->calls++; $this->sent[] = $payload;
        $last = end($payload['messages']);
        $usage = ['input_tokens' => 100, 'output_tokens' => 50, 'cache_creation_input_tokens' => 3000, 'cache_read_input_tokens' => 0];
        if (is_string($last['content'])) {
            return ['stop_reason' => 'tool_use', 'usage' => $usage, 'content' => [['type' => 'tool_use', 'id' => 'tu_' . $this->calls, 'name' => 'list_sites', 'input' => []]]];
        }
        $usage['cache_creation_input_tokens'] = 0; $usage['cache_read_input_tokens'] = 3000;
        return ['stop_reason' => 'end_turn', 'usage' => $usage, 'content' => [['type' => 'text', 'text' => "**Conclusion:** Shackleton gets more sunlight [1].\n\n**Trade-off:** IM-2 sees Earth more often [1].\n\n| Site | Sun |\n|---|---|\n| A | 99.8 % |\n\n**Assumptions:** body centre."]]];
    }
};
$cc = $config;
$cc['cache'] = ['driver' => 'file', 'path' => $tmp . '/cache-cost'];
$cc['ai']['api_key'] = 'test-key';
$cc['ai']['per_ip_per_hour'] = 3;
$cc['ai']['daily_claude_requests'] = 200;
$costApp = new App($cc, new HorizonsClient(new FileCache($tmp . '/cache2'), 'unused', 5, $fake2));
$costApp->claudeHttp = $fakeClaude;
$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
$scen = ['a' => 'shackleton_ridge', 'b' => 'im2_athena', 'start' => '2030-07-01', 'days' => 30, 'mode' => 'terrain', 'delay' => 10, 'earth_margin' => 0, 'power' => []];
$q1 = ['question' => 'Compare   Shackleton and IM-2', 'lang' => 'en', 'mode' => 'technical', 'scenario' => $scen];
$r1 = $costApp->handle('POST', '/analyst', [], $q1);
check('analyst miss: answered by Claude (2 requests: tool round + answer), not marked cached', $r1['cached'] === false && $fakeClaude->calls === 2 && count($r1['trace']) === 1);
$r2 = $costApp->handle('POST', '/analyst', [], ['question' => ' compare shackleton AND im-2 '] + $q1);
check('analyst hit: same question (case and spaces ignored) comes from the cache, no API call', $r2['cached'] === true && $fakeClaude->calls === 2 && $r2['answer'] === $r1['answer'] && $r2['trace'] === $r1['trace'] && isset($r2['cached_at']));
$r3 = $costApp->handle('POST', '/analyst', [], ['lang' => 'pt'] + $q1);
check('analyst: another language is a different answer (miss)', $r3['cached'] === false && $fakeClaude->calls === 4);
$u = $costApp->usage()->day();
check('usage counters: requests, questions, cache hits, tokens incl. prompt-cache reads/writes', $u['claude_requests'] === 4 && $u['claude_questions'] === 2 && $u['analyst_cache_hits'] === 1
    && $u['claude_input_tokens'] === 400 && $u['claude_output_tokens'] === 200 && $u['claude_cache_write_tokens'] === 6000 && $u['claude_cache_read_tokens'] === 6000);

$an = new Analyst($cc, new Tools($costApp->sites, $costApp->scenarios), $costApp->cache, $costApp->usage());
$k1 = $an->cacheKey('Compare  Shackleton', 'en', 'technical', $scen);
check('cache key: stable, hashed, "analyst:v1:" prefix, nothing personal in it', preg_match('/^analyst:v1:[a-f0-9]{64}$/', $k1) === 1 && $k1 === $an->cacheKey(' compare shackleton ', 'en', 'technical', $scen) && !str_contains($k1, '203.0.113.7'));
check('cache key: explicit default power inputs = omitted power inputs', $k1 === $an->cacheKey('compare shackleton', 'en', 'technical', ['power' => LunarNav\Metrics\Power::params([])] + $scen));
check('cache key: changes with scenario, mode, language and conversation', count(array_unique([$k1,
    $an->cacheKey('compare shackleton', 'en', 'technical', ['start' => '2030-07-11'] + $scen),
    $an->cacheKey('compare shackleton', 'en', 'learn', $scen),
    $an->cacheKey('compare shackleton', 'es', 'technical', $scen),
    $an->cacheKey('compare shackleton', 'en', 'technical', $scen, [['role' => 'user', 'content' => 'earlier'], ['role' => 'assistant', 'content' => 'x']]),
])) === 5);
$cc2 = $cc; $cc2['ai']['model'] = 'claude-sonnet-5-5';
check('cache key: changes with the model', $k1 !== (new Analyst($cc2, new Tools($costApp->sites, $costApp->scenarios), $costApp->cache, $costApp->usage()))->cacheKey('compare shackleton', 'en', 'technical', $scen));

$code = static function (callable $f): string { try { $f(); return 'ok'; } catch (ApiError $e) { return $e->errorCode; } };
check('question over 500 characters: polite coded error', $code(fn() => $costApp->handle('POST', '/analyst', [], ['question' => str_repeat('a', 501)] + $q1)) === 'question_too_long');
// Per-client hourly limit (3 here): two real questions already used it twice; one more is allowed, the next is not.
check('per-client limit: 3rd real question allowed', $code(fn() => $costApp->handle('POST', '/analyst', [], ['question' => 'third'] + $q1)) === 'ok');
check('per-client limit: 4th real question refused (analyst_ip)', $code(fn() => $costApp->handle('POST', '/analyst', [], ['question' => 'fourth'] + $q1)) === 'analyst_ip');
check('per-client limit: cached answers stay free after the limit', $code(fn() => $costApp->handle('POST', '/analyst', [], $q1)) === 'ok');
$_SERVER['REMOTE_ADDR'] = '198.51.100.9';
check('per-client limit: another client is not affected', $code(fn() => $costApp->handle('POST', '/analyst', [], ['question' => 'from another client'] + $q1)) === 'ok');
// Global daily cap on real Claude requests (8 used so far: 4 questions × 2).
$cc3 = $cc; $cc3['ai']['daily_claude_requests'] = 9;
$capApp = new App($cc3, new HorizonsClient(new FileCache($tmp . '/cache2'), 'unused', 5, $fake2));
$capApp->claudeHttp = $fakeClaude;
$before = $fakeClaude->calls;
check('global daily cap: a question that would exceed it is not started (analyst_daily, no API call)', $code(fn() => $capApp->handle('POST', '/analyst', [], ['question' => 'over the cap'] + $q1)) === 'analyst_daily' && $fakeClaude->calls === $before);
check('global daily cap: cached answers are still served', $code(fn() => $capApp->handle('POST', '/analyst', [], $q1)) === 'ok');

// Prompt caching: explicit breakpoint on the system prompt + top-level automatic caching.
$p0 = $fakeClaude->sent[0];
check('prompt caching: system as a block with cache_control, top-level cache_control, tools sent', ($p0['system'][0]['cache_control'] ?? null) === ['type' => 'ephemeral'] && ($p0['cache_control'] ?? null) === ['type' => 'ephemeral'] && !empty($p0['tools']));
check('prompt caching: the scenario goes in the user message, after the cached prefix', str_contains($p0['messages'][0]['content'], '[Current app scenario: site A shackleton_ridge') && !str_contains($p0['system'][0]['text'], 'shackleton_ridge'));
$rej = clone $fakeClaude; $rej->rejectCacheControl = true; $rej->calls = 0;
LunarNav\Agent\AnthropicProvider::resetCacheControl();
$pr = new LunarNav\Agent\AnthropicProvider('k', 'claude-opus-5-5', 'https://example.invalid', 1200, $rej);
$rr = $pr->run('sys', [], 'q', Tools::definitions(), fn() => ['ok' => true], 6);
check('prompt caching: an API that rejects cache_control is retried without it (no failure)', str_contains($rr['text'], 'Conclusion') && !isset(end($rej->sent)['cache_control']));
LunarNav\Agent\AnthropicProvider::resetCacheControl();
check('max_steps capped at 6, max_tokens default 1200', $p0['max_tokens'] === 1200 && (require __DIR__ . '/../config.example.php')['ai']['max_steps'] === 6);

// Spoken summary.
$ansEn = "**Conclusion:** Shackleton rim gets far more sunlight [1][2]. It stays lit for 555.7 h [1].\n\n**Trade-off:** IM-2 sees Earth for 80.2 % of the period [2].\n\n| Site | Sun |\n|---|---|\n| A | 99.8 % |\n\n**Assumptions:**\n- Visibility uses the body centre.";
$sEn = Voice::summary($ansEn);
check('summary: Conclusion + Trade-off only; no table, citations, labels markup or assumptions', $sEn === "Conclusion: Shackleton rim gets far more sunlight. It stays lit for 555.7 h.\n\nTrade-off: IM-2 sees Earth for 80.2 % of the period.", $sEn);
check('summary: Portuguese and Spanish labels', str_starts_with(Voice::summary("**Conclusão:** A [1].\n\n**Trade-off:** B.\n\n**Premissas:** C."), 'Conclusão: A.') && !str_contains(Voice::summary("**Conclusão:** A.\n\n**Premissas:** C."), 'C.')
    && str_starts_with(Voice::summary("**Conclusión:** A.\n\n**Trade-off:** B.\n\n**Supuestos:** C."), 'Conclusión: A.') && !str_contains(Voice::summary("**Conclusión:** A.\n\n**Supuestos:** C."), 'C.'));
check('summary: without labels, the first paragraph', Voice::summary("First paragraph here [1].\n\nSecond.") === 'First paragraph here.');
$long = '**Conclusion:** ' . str_repeat('This is a sentence of the summary. ', 60);
check('summary: at most 900 characters, ending at a sentence', mb_strlen(Voice::summary($long)) <= 900 && str_ends_with(Voice::summary($long), '.'));
check('full answer: at most 2 500 characters, no table', mb_strlen(Voice::spoken(str_repeat("Line of text here. ", 300), 'full')) <= 2500 && !str_contains(Voice::spoken($ansEn, 'full'), '|'));

// TTS cache.
$fakeEleven = new class extends LunarNav\Http\HttpClient {
    public int $tts = 0; public int $stt = 0;
    public function request(string $method, string $url, array $headers = [], ?string $body = null, ?array $multipart = null): array
    {
        if (str_contains($url, 'speech-to-text')) { $this->stt++; return ['status' => 200, 'body' => '{"text":"hello moon"}', 'headers' => []]; }
        $this->tts++;
        return ['status' => 200, 'body' => 'ID3-fake-mp3-' . md5((string) $body), 'headers' => []];
    }
};
$cv = $cc;
$cv['voice']['elevenlabs'] = ['api_key' => 'k', 'voice_id' => 'v1', 'tts_model' => 'm1', 'stt_model' => 'scribe_v1'];
$cv['voice']['tts_per_ip_per_hour'] = 3; $cv['voice']['tts_chars_per_day'] = 400; $cv['voice']['stt_per_ip_per_hour'] = 2; $cv['voice']['stt_per_day'] = 3;
$cv['cache'] = ['driver' => 'file', 'path' => $tmp . '/cache-voice'];
$vApp = new App($cv, new HorizonsClient(new FileCache($tmp . '/cache2'), 'unused', 5, $fake2));
$vApp->voiceHttp = $fakeEleven; $vApp->ttsDir = $tmp . '/tts';
$_SERVER['REMOTE_ADDR'] = '192.0.2.1';
$t1 = $vApp->voice('/tts', ['text' => $ansEn, 'lang' => 'en', 'part' => 'summary']);
$t2 = $vApp->voice('/tts', ['text' => $ansEn, 'lang' => 'en', 'part' => 'summary']);
check('TTS cache: same text → same file, one ElevenLabs call', $t1['cached'] === false && $t2['cached'] === true && $t1['h'] === $t2['h'] && $fakeEleven->tts === 1 && is_file($tmp . '/tts/' . substr($t1['h'], 0, 2) . '/' . $t1['h'] . '.mp3'));
$v0 = new Voice($cv, null, $tmp . '/tts');
check('TTS cache: hash of spoken text, voice, model and language', $v0->ttsHash('a', 'en') !== $v0->ttsHash('a', 'pt') && $v0->ttsHash('a', 'en') === hash('sha256', json_encode(['a', 'v1', 'm1', 'en'], JSON_UNESCAPED_UNICODE)));
check('TTS: only the summary is spoken by default', $t1['chars'] === mb_strlen($sEn));
check('TTS: a file name that is not a hash is refused', $code(fn() => $v0->ttsPath('../../config')) === 'bad_request');
// Global daily characters (400): the summary used ~120; a 2 500-character full answer would exceed it.
check('TTS global daily characters: over the cap → tts_daily (the app then uses the browser voice)', $code(fn() => $vApp->voice('/tts', ['text' => str_repeat('Word ', 600), 'lang' => 'en', 'part' => 'full'])) === 'tts_daily' && $fakeEleven->tts === 1);
check('TTS per-client hourly limit → tts_ip', $code(fn() => $vApp->voice('/tts', ['text' => 'x y z.', 'lang' => 'en'])) === 'tts_ip');
// STT.
check('STT: over 2 MB → stt_too_long; over 30 s → stt_too_long; empty → stt_empty', $code(fn() => Voice::checkClip(2_000_001, 5)) === 'stt_too_long' && $code(fn() => Voice::checkClip(1000, 31)) === 'stt_too_long' && $code(fn() => Voice::checkClip(0, 1)) === 'stt_empty' && $code(fn() => Voice::checkClip(1000, 29.9)) === 'ok');
$clip = ['tmp_name' => __FILE__, 'type' => 'audio/webm', 'size' => 50_000];
$s1 = $vApp->voice('/stt', ['lang' => 'en', 'duration' => '12.5'], $clip);
check('STT: transcript returned (ElevenLabs only), seconds counted', $s1['text'] === 'hello moon' && $vApp->usage()->get('stt_seconds') == 12.5);
$vApp->voice('/stt', ['lang' => 'en', 'duration' => '3'], $clip);
check('STT per-client hourly limit → stt_ip', $code(fn() => $vApp->voice('/stt', ['lang' => 'en', 'duration' => '3'], $clip)) === 'stt_ip');
$_SERVER['REMOTE_ADDR'] = '192.0.2.2';
$vApp->voice('/stt', ['lang' => 'en', 'duration' => '3'], $clip);
check('STT global daily limit → stt_daily', $code(fn() => $vApp->voice('/stt', ['lang' => 'en', 'duration' => '3'], $clip)) === 'stt_daily' && $fakeEleven->stt === 3);
check('STT: an oversized clip is refused before any call', $code(fn() => $vApp->voice('/stt', ['duration' => '45'], $clip)) === 'stt_too_long' && $fakeEleven->stt === 3);
unset($_SERVER['REMOTE_ADDR']);

echo "Spoken summary: title variants; TTS retries\n";
// A made-up key, built at run time so no key-shaped literal sits in the source (it only proves redaction).
const FAKE_KEY = 'sk' . '_' . 'NOTAREALKEY' . 'XXXXXXXXXX';
$sv = static fn(string $md) => Voice::summary($md);
$variants = [
    'EN Bottom line' => ["**Bottom line:** A is better [1].\n\n**Trade-off:** B sees Earth.\n\n**Assumptions:** x.", 'Bottom line: A is better.'],
    'EN Summary heading' => ["## Summary\nA is better [1].\n\n## Trade-off\nB sees Earth.\n\n## Assumptions\nx", 'Summary'],
    'PT Resultado' => ["**Resultado:** A é melhor.\n\n**Compromisso:** B vê a Terra.\n\n**Premissas:** x.", 'Resultado: A é melhor.'],
    'PT Em resumo' => ["Em resumo: A é melhor.\n\nCompensação: B vê a Terra.\n\nPremissas: x.", 'Em resumo: A é melhor.'],
    'ES Conclusión principal' => ["**Conclusión principal:** A es mejor.\n\n**Compensación:** B ve la Tierra.\n\n**Supuestos:** x.", 'Conclusión principal: A es mejor.'],
    'ES En resumen' => ["**En resumen**: A es mejor.\n\n**Compromiso**: B ve la Tierra.\n\n**Supuestos**: x.", 'En resumen: A es mejor.'],
];
$okV = true; $bad = [];
foreach ($variants as $name => [$md, $startsWith]) {
    $x = $sv($md);
    if (!str_starts_with($x, $startsWith) || str_contains($x, ': x') || str_contains($x, "\nx") || $x === '') { $okV = false; $bad[] = "$name → $x"; }
}
check('summary: conclusion titles in EN/PT/ES (incl. Bottom line, Summary, Resultado, Em resumo, En resumen, Conclusión principal), up to the assumptions', $okV, implode(' | ', $bad));
check('summary: trade-off variants are kept (Compromisso / Compensación / Compromiso)', str_contains($sv($variants['PT Resultado'][0]), 'Compromisso: B vê a Terra.') && str_contains($sv($variants['ES Conclusión principal'][0]), 'Compensación: B ve la Tierra.'));
check('summary: only a trade-off title → from the start of the answer to the assumptions', $sv("A is better [1].\n\n**Trade-off:** B sees Earth.\n\n**Assumptions:** x.") === "A is better.\n\nTrade-off: B sees Earth.");
check('summary: no title → first paragraph (no table, no citations), ≤ 900', $sv("| a | b |\n|---|---|\n| 1 | 2 |\n\nFirst real paragraph [3][4].\n\nSecond.") === 'First real paragraph.' && mb_strlen($sv(str_repeat('Long sentence here. ', 100))) <= 900);
check('summary: a word that merely starts a sentence is not a title ("Summary of…" without colon)', $sv("Summary of the run is good.\n\nMore.") === 'Summary of the run is good.');
check('summary: snake_case ids are read as words, _emphasis_ removed', $sv('**Conclusion:** shackleton_ridge is _best_ [1].') === 'Conclusion: shackleton ridge is best.');

$flaky = new class extends LunarNav\Http\HttpClient {
    public array $plan = []; public int $calls = 0; public array $headersSeen = [];
    public function request(string $method, string $url, array $headers = [], ?string $body = null, ?array $multipart = null): array
    {
        $this->calls++; $this->headersSeen = $headers;
        $s = array_shift($this->plan) ?? 200;
        return $s === 200 ? ['status' => 200, 'body' => 'ID3-mp3', 'headers' => []]
            : ['status' => $s, 'body' => json_encode(['detail' => ['status' => $s === 429 ? 'too_many_concurrent_requests' : 'server_error', 'message' => 'Upstream says busy; key ' . FAKE_KEY . ' was used']]), 'headers' => []];
    }
};
$waited = [];
$cvr = $cv; $cvr['voice']['elevenlabs']['api_key'] = FAKE_KEY;
$vr = new Voice($cvr, $flaky, $tmp . '/tts-retry', function (int $s) use (&$waited) { $waited[] = $s; });
$flaky->plan = [429, 503];
$rr1 = $vr->speakCached('Retry me please.', 'en');
check('TTS retry: 429 then 503 then success → 3 calls, waits 2 s and 5 s, file written', $flaky->calls === 3 && $waited === [2, 5] && $rr1['cached'] === false);
$flaky->calls = 0; $waited = []; $flaky->plan = [503, 503, 503, 503];
$err = '';
try { $vr->speakCached('Always busy.', 'en'); } catch (ApiError $e) { $err = $e->getMessage(); }
check('TTS retry: gives up after 3 retries (2, 5, 10 s), error has HTTP code and short message, never the key', $flaky->calls === 4 && $waited === [2, 5, 10] && str_contains($err, 'ElevenLabs HTTP 503') && str_contains($err, 'after 3 retries') && !str_contains($err, 'NOTAREALKEY'), $err);
$flaky->calls = 0; $waited = []; $flaky->plan = [401];
try { $vr->speakCached('Bad key.', 'en'); } catch (ApiError $e) { $err = $e->getMessage(); }
check('TTS retry: a 4xx other than 429 is not retried', $flaky->calls === 1 && $waited === [] && str_contains($err, 'HTTP 401'));
// Failed attempts do not count as usage (route level).
$vApp2 = new App($cvr + ['_' => 1], new HorizonsClient(new FileCache($tmp . '/cache2'), 'unused', 5, $fake2));
$vApp2->voiceHttp = $flaky; $vApp2->ttsDir = $tmp . '/tts-retry2';
$vApp2->voiceSleep = function (int $s) use (&$waited) { $waited[] = $s; };
$flaky->plan = [503, 503, 503, 503];
$_SERVER['REMOTE_ADDR'] = '192.0.2.50';
$before2 = $vApp2->usage()->day();
$failedCode = $code(fn() => (new ReflectionClass($vApp2))->getMethod('voice')->invoke($vApp2, '/tts', ['text' => '**Conclusion:** never spoken.', 'lang' => 'en']));
$after2 = $vApp2->usage()->day();
check('TTS: failed attempts are not counted as usage (no tts_requests / tts_chars added)', $failedCode === 'tts_unavailable' && ($after2['tts_requests'] ?? 0) === ($before2['tts_requests'] ?? 0) && ($after2['tts_chars'] ?? 0) === ($before2['tts_chars'] ?? 0));
unset($_SERVER['REMOTE_ADDR']);

echo "\n{$count} checks, {$failures} failed\n";
exit($failures === 0 ? 0 : 1);
