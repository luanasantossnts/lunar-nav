<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Reference;

use LunarNav\Geo\Frames;
use LunarNav\Metrics\Metrics;
use LunarNav\Metrics\Scenarios;
use LunarNav\Terrain\HorizonMask;
use LunarNav\Terrain\TerrainStore;

/**
 * Independent check: our pipeline over a whole calendar year against NASA PGDA 69
 * (~18.6-year hourly averages). The year is run in blocks within the period limit, at a
 * 60-minute step, terrain mode, margin 0, DSN off. PGDA counts a body as visible when any
 * fraction of its disc is up (its labels), so the like-for-like comparison is our first
 * limb; the disc centre is reported alongside. Nothing here is tuned to the reference.
 */
final class PgdaComparison
{
    /** Year split into blocks shorter than the 200-day limit. */
    public static function blocks(int $year): array
    {
        $a = gmmktime(0, 0, 0, 1, 1, $year);
        $m = gmmktime(0, 0, 0, 7, 2, $year);
        $b = gmmktime(0, 0, 0, 1, 1, $year + 1);
        return [[$a, $m], [$m, $b]];
    }

    /** One site: our year (point and 300 m median, centre and first limb) vs PGDA. */
    public static function site(Scenarios $sc, TerrainStore $terrain, ReferenceStore $ref, array $site, int $year): array
    {
        $pg = $ref->raw($site['id']);
        if (!$pg || empty($pg['available'])) {
            return ['site' => $site['id'], 'available' => false];
        }
        $mode = $terrain->mask($site['id']) ? 'terrain' : 'geometric';
        $acc = ['sun_c' => 0, 'sun_f' => 0, 'earth_c' => 0, 'earth_f' => 0, 'total' => 0];
        $grid = $terrain->grid($site['id']);
        $near = $grid ? array_values(array_filter($grid['points'], static fn($p) => hypot($p['dx_m'], $p['dy_m']) <= Scenarios::SPREAD_RADIUS_M + 1e-6)) : [];
        $gridAcc = array_fill(0, count($near), ['sun' => 0, 'earth' => 0]);
        foreach (self::blocks($year) as [$s, $e]) {
            $days = (int) round(($e - $s) / 86400);
            $r = $sc->run($site, $s, $days, 60, $mode, 0.0, 0.0);
            $m = $r['metrics'];
            $acc['sun_c'] += $m['sun']['hours'] * 3600;
            $acc['sun_f'] += $m['sun']['disc_range']['first_limb']['hours'] * 3600;
            $acc['earth_c'] += $m['earth']['hours'] * 3600;
            $acc['earth_f'] += $m['earth']['disc_range']['first_limb']['hours'] * 3600;
            $acc['total'] += $e - $s;
            if ($near) {
                $ser = $sc->periodSeries($site, $s, $e, 60);
                foreach ($near as $i => $p) {
                    $mask = HorizonMask::fromArray(['az_step_deg' => $p['az_step_deg'] ?? $grid['az_step_deg'], 'elevations' => $p['elevations']]);
                    $h = static fn(float $az): float => $mask->at($az);
                    $to = ['lat' => $p['lat'], 'lon' => $p['lon']];
                    $gridAcc[$i]['sun'] += Metrics::totalSeconds(Metrics::spans(Frames::transferSeries($ser['sun'], $site, $to), $h, -Metrics::SUN_RADIUS_DEG));
                    $gridAcc[$i]['earth'] += Metrics::totalSeconds(Metrics::spans(Frames::transferSeries($ser['earth'], $site, $to), $h, -Metrics::EARTH_RADIUS_DEG));
                }
            }
        }
        $T = max(1, $acc['total']);
        $med = static fn(string $k) => $near ? round(Metrics::percentile(array_map(static fn($g) => $g[$k] / $T, $gridAcc), 50), 4) : null;
        $ours = [
            'sun_centre' => round($acc['sun_c'] / $T, 4),
            'sun_first_limb' => round($acc['sun_f'] / $T, 4),
            'earth_centre' => round($acc['earth_c'] / $T, 4),
            'earth_first_limb' => round($acc['earth_f'] / $T, 4),
            'sun_first_limb_median_300m' => $med('sun'),
            'earth_first_limb_median_300m' => $med('earth'),
        ];
        $ref300 = [$pg['sun']['within_300m']['median'], $pg['earth']['within_300m']['median']];
        return [
            'site' => $site['id'],
            'available' => true,
            'mode' => $mode,
            'dem_m' => $mode === 'terrain' ? (float) ($terrain->mask($site['id'])->meta['pixel_m'] ?? 0) : null,
            'pgda_resolution_m' => $pg['product']['resolution_m'],
            'ours' => $ours,
            'pgda' => ['sun' => $pg['sun']['at_site'], 'earth' => $pg['earth']['at_site'], 'sun_median_300m' => $ref300[0], 'earth_median_300m' => $ref300[1]],
            'delta_points' => [
                'sun' => round(100 * ($ours['sun_first_limb'] - $pg['sun']['at_site']), 1),
                'earth' => round(100 * ($ours['earth_first_limb'] - $pg['earth']['at_site']), 1),
                'sun_median_300m' => $ours['sun_first_limb_median_300m'] === null ? null : round(100 * ($ours['sun_first_limb_median_300m'] - $ref300[0]), 1),
                'earth_median_300m' => $ours['earth_first_limb_median_300m'] === null ? null : round(100 * ($ours['earth_first_limb_median_300m'] - $ref300[1]), 1),
            ],
        ];
    }

    /**
     * All sites, plus the ranking check. Status rule (fixed before looking at the numbers):
     * numerically verified when the Sun ranking matches and |Δ Sun| ≤ 10 points at every
     * site whose terrain comes from the 40 m DEM; otherwise needs investigation.
     */
    public static function run(Scenarios $sc, TerrainStore $terrain, ReferenceStore $ref, array $sites, int $year = 2030): array
    {
        $sc->configureDsn(false);
        $rows = [];
        foreach ($sites as $s) {
            $row = self::site($sc, $terrain, $ref, $s, $year);
            if ($row['available']) $rows[] = $row;
        }
        $rank = static function (array $rows, callable $v) {
            $ids = array_column($rows, 'site');
            $vals = array_map($v, $rows);
            array_multisort($vals, SORT_DESC, $ids);
            return $ids;
        };
        $oursRank = $rank($rows, static fn($r) => $r['ours']['sun_first_limb']);
        $pgdaRank = $rank($rows, static fn($r) => $r['pgda']['sun']);
        $dem40 = array_filter($rows, static fn($r) => $r['dem_m'] !== null && abs($r['dem_m'] - 40.0) < 1e-6);
        $maxDelta40 = $dem40 ? max(array_map(static fn($r) => abs($r['delta_points']['sun']), $dem40)) : null;
        $ok = $oursRank === $pgdaRank && $maxDelta40 !== null && $maxDelta40 <= 10.0;
        return [
            'year' => $year,
            'criterion' => 'first limb (any fraction of the disc), as in the PGDA labels; disc centre shown for information',
            'rows' => $rows,
            'ranking' => ['ours' => $oursRank, 'pgda' => $pgdaRank, 'same' => $oursRank === $pgdaRank],
            'max_abs_delta_sun_dem40' => $maxDelta40,
            'status' => $ok ? 'numerically verified' : 'needs investigation',
        ];
    }
}
