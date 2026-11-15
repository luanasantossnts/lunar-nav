<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Metrics;

use InvalidArgumentException;
use LunarNav\Cache\Cache;
use LunarNav\Dsn\DsnNetwork;
use LunarNav\Geo\Frames;
use LunarNav\Reference\ReferenceStore;
use LunarNav\Horizons\HorizonsClient;
use LunarNav\Terrain\HorizonMask;
use LunarNav\Terrain\TerrainStore;

/**
 * Scenario-level operations: single site/period, comparison, delay, date search,
 * and the sensitivity grid. Every result carries a provenance block.
 */
final class Scenarios
{
    /** Points within this distance of the site feed the position spread (P10–P90). */
    public const SPREAD_RADIUS_M = 300.0;

    /** Night and gap lengths are measured on series extended by this many days on each side. */
    public const NIGHT_EXT_DAYS = 15;
    public const NIGHT_NOTE = 'Night lengths are measured in full for nights that overlap the period (series extended by 15 days on each side); fractions and energy use the period only.';

    /** Long-term reference (NASA PGDA 69), attached to every scenario when available. */
    private ?ReferenceStore $reference = null;

    public function setReference(ReferenceStore $reference): void
    {
        $this->reference = $reference;
    }

    /** Power-model inputs for the current request (Power::params). */
    private array $power = Power::DEFAULTS;
    private bool $dsnOn = true;
    private float $dsnMinEl = 10.0;
    /** Station spans per period and minimum elevation, reused within one request. */
    private array $dsnMemo = [];

    public function __construct(
        private HorizonsClient $horizons,
        private TerrainStore $terrain,
        private int $maxDays = 200,
        private ?Cache $cache = null,
        private ?DsnNetwork $dsn = null
    ) {
        if ($dsn !== null) {
            $this->dsnMinEl = $dsn->defaultMinElevation();
        }
    }

    /** Per-request DSN options: on/off and the minimum Moon elevation at the stations (0–20°). */
    public function configureDsn(bool $on, ?float $minElevation = null): void
    {
        $this->dsnOn = $on;
        $this->dsnMinEl = $minElevation !== null
            ? max(0.0, min(20.0, $minElevation))
            : ($this->dsn?->defaultMinElevation() ?? 10.0);
    }

    /** Per-request power inputs; missing or invalid values fall back to the defaults. */
    public function configurePower(array $in): void
    {
        $this->power = Power::params($in);
    }

    public function powerParams(): array
    {
        return $this->power;
    }

    public function dsnEnabled(): bool
    {
        return $this->dsn !== null && $this->dsnOn;
    }

    /**
     * Spans when each DSN station sees the Moon above the minimum elevation in [start, end].
     * @return array{spans:array<string,list<array{0:int,1:int}>>, cached:bool}
     */
    private function dsnSpans(int $start, int $end, ?int $step = null): array
    {
        $step ??= $this->dsn->stepMinutes();
        $key = "{$start}:{$end}:{$step}:{$this->dsnMinEl}";
        if (isset($this->dsnMemo[$key])) {
            return $this->dsnMemo[$key];
        }
        $flat = static fn(float $az): float => 0.0;
        $spans = [];
        $cached = true;
        foreach ($this->dsn->stations() as $s) {
            $r = $this->horizons->stationSeries($s['horizons_center'], $start, $end, $step);
            $spans[$s['id']] = Metrics::spans($r['rows'], $flat, $this->dsnMinEl);
            $cached = $cached && $r['cached'];
        }
        return $this->dsnMemo[$key] = ['spans' => $spans, 'cached' => $cached];
    }

    /** DSN union coverage of the Moon over [start, end] at a given step (validation). */
    public function dsnCoverage(int $start, int $end, int $step): array
    {
        if (!$this->dsnEnabled()) {
            throw new InvalidArgumentException('DSN is not enabled.');
        }
        $d = $this->dsnSpans($start, $end, $step);
        $c = Metrics::comm([[$start, $end]], [], [], $d['spans'], $start, $end);
        return [
            'union' => $c['dsn_union']['fraction'],
            'longest_gap_h' => round(Metrics::longestGap($c['dsn_union']['spans'], $start, $end) / 3600, 2),
            'stations' => array_map(static fn($s) => $s['fraction'], $c['stations']),
            'min_elevation_deg' => $this->dsnMinEl,
            'step_minutes' => $step,
        ];
    }

    private function dsnProvenance(?bool $cached): array
    {
        if (!$this->dsnEnabled()) {
            return ['enabled' => false];
        }
        return ['enabled' => true] + $this->dsn->describe($this->dsnMinEl) + ['cached' => $cached];
    }

    /**
     * Fetches Sun and Earth series over the period extended by NIGHT_EXT_DAYS on each side.
     * Returns [sun, earth, wStart, wEnd]; each series also carries 'period_rows', sliced to
     * [start, end], which every fraction, hour and energy figure uses.
     */
    private function series(array $site, int $start, int $end, int $step): array
    {
        $days = ($end - $start) / 86400;
        if ($days > $this->maxDays) {
            throw new InvalidArgumentException("Period longer than {$this->maxDays} days.");
        }
        $wStart = $start - self::NIGHT_EXT_DAYS * 86400;
        $wEnd = $end + self::NIGHT_EXT_DAYS * 86400;
        $sun = $this->horizons->series(HorizonsClient::SUN, $site, $wStart, $wEnd, $step);
        $earth = $this->horizons->series(HorizonsClient::EARTH, $site, $wStart, $wEnd, $step);
        $sun['period_rows'] = Metrics::slice($sun['rows'], $start, $end);
        $earth['period_rows'] = Metrics::slice($earth['rows'], $start, $end);
        return [$sun, $earth, $wStart, $wEnd];
    }

    /**
     * Replaces the longest dark period (Sun), the longest gap without Earth and without
     * contact by their full length: the longest of the gaps that overlap the period,
     * measured within the extended window. lower_bound only at that window's edge.
     */
    private function fullNights(array &$m, array $sun, array $earth, callable $h, float $sunMargin, float $earthMargin, int $wStart, int $wEnd, int $start, int $end, ?array $dsnSpans): void
    {
        $si = Metrics::longestGapOverlapping(Metrics::spans($sun['rows'], $h, $sunMargin), $wStart, $wEnd, $start, $end);
        $m['sun']['longest_hidden_h'] = round($si[0] / 3600, 2);
        $m['sun']['longest_hidden_lower_bound'] = $si[1];
        $m['sun']['longest_hidden_placement'] = Metrics::gapPlacement($si, $start, $end);
        $earthSpans = Metrics::spans($earth['rows'], $h, $earthMargin);
        $ei = Metrics::longestGapOverlapping($earthSpans, $wStart, $wEnd, $start, $end);
        $m['earth']['longest_hidden_h'] = round($ei[0] / 3600, 2);
        $m['earth']['longest_hidden_lower_bound'] = $ei[1];
        $m['earth']['longest_hidden_placement'] = Metrics::gapPlacement($ei, $start, $end);
        if ($dsnSpans !== null && isset($m['comm'])) {
            $union = Metrics::intersect(Metrics::union(array_values($dsnSpans)), [[$wStart, $wEnd]]);
            $ci = Metrics::longestGapOverlapping(Metrics::intersect($earthSpans, $union), $wStart, $wEnd, $start, $end);
            $m['comm']['longest_gap_h'] = round($ci[0] / 3600, 2);
            $m['comm']['longest_gap_lower_bound'] = $ci[1];
            $m['comm']['longest_gap_placement'] = Metrics::gapPlacement($ci, $start, $end);
        }
    }

    /** Sun and Earth rows for [start, end] only (used by the PGDA comparison). */
    public function periodSeries(array $site, int $start, int $end, int $step): array
    {
        [$sun, $earth] = $this->series($site, $start, $end, $step);
        return ['sun' => $sun['period_rows'], 'earth' => $earth['period_rows']];
    }

    /**
     * Share of each calendar month in which the Sun and Earth are above the horizon (body
     * centre, no margin), from the given contiguous blocks (the same half-year runs as the
     * PGDA comparison, so the series come from the cache). Time outside the blocks is ignored.
     * @param list<array{0:int,1:int}> $blocks
     */
    public function monthly(array $site, int $year, string $mode, array $blocks): array
    {
        [$h, $info] = $this->horizonFor($site, $mode);
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[] = [gmmktime(0, 0, 0, $m, 1, $year), gmmktime(0, 0, 0, $m + 1, 1, $year)];
        }
        $acc = array_fill(0, 12, ['sun' => 0, 'earth' => 0, 'total' => 0]);
        foreach ($blocks as [$s, $e]) {
            $ser = $this->periodSeries($site, $s, $e, 60);
            foreach ($months as $i => [$ms, $me]) {
                $acc[$i]['total'] += max(0, min($me, $e) - max($ms, $s));
            }
            foreach (['sun', 'earth'] as $b) {
                foreach (Metrics::spans($ser[$b], $h, 0.0) as [$a, $z]) {
                    foreach ($months as $i => [$ms, $me]) {
                        $o = min($z, $me, $e) - max($a, $ms, $s);
                        if ($o > 0) $acc[$i][$b] += $o;
                    }
                }
            }
        }
        $out = [];
        foreach ($acc as $i => $x) {
            $out[] = [
                'month' => $i + 1,
                'sun_fraction' => $x['total'] > 0 ? round($x['sun'] / $x['total'], 4) : null,
                'earth_fraction' => $x['total'] > 0 ? round($x['earth'] / $x['total'], 4) : null,
            ];
        }
        return ['horizon' => $info, 'months' => $out];
    }

    /** Horizon function and its description for the requested mode. */
    private function horizonFor(array $site, string $mode): array
    {
        $flat = static fn(float $az): float => 0.0;
        if ($mode !== 'terrain') {
            return [$flat, ['mode' => 'geometric', 'terrain' => 'not requested']];
        }
        $mask = $site['id'] !== 'custom' ? $this->terrain->mask($site['id']) : null;
        if ($mask === null) {
            return [$flat, ['mode' => 'geometric', 'terrain' => 'unavailable for this site']];
        }
        return [static fn(float $az): float => $mask->at($az), ['mode' => 'terrain', 'terrain' => 'applied', 'mask' => $mask->meta]];
    }

    private function provenance(array $site, array $sun, array $earth, array $horizonInfo, int $step, array $margins): array
    {
        return [
            'source' => $this->horizons->label,
            'method_version' => LUNARNAV_METHOD_VERSION,
            'site' => ['id' => $site['id'], 'lat' => $site['lat'], 'lon' => $site['lon'], 'alt_km' => $site['alt_km'] ?? 0.0, 'source' => $site['source'] ?? null],
            'horizons_params' => array_diff_key($sun['params'], ['COMMAND' => 1, 'format' => 1]),
            'bodies' => ['sun' => '10', 'earth' => '399'],
            'step_minutes' => $step,
            'horizon' => $horizonInfo,
            'visibility' => sprintf('body centre; range = first limb (margin − r) … full disc (margin + r), r = %.3f° Sun, %.2f° Earth', Metrics::SUN_RADIUS_DEG, Metrics::EARTH_RADIUS_DEG),
            'margins_deg' => $margins,
            'night_window' => ['extended_days' => self::NIGHT_EXT_DAYS, 'ephemeris_start' => trim($sun['params']['START_TIME'], "'"), 'ephemeris_stop' => trim($sun['params']['STOP_TIME'], "'"), 'note' => self::NIGHT_NOTE],
            'cached' => $sun['cached'] && $earth['cached'],
            'computed_at' => gmdate('c'),
        ];
    }

    public function run(array $site, int $start, int $days, int $step = 60, string $mode = 'geometric', float $sunMargin = 0.0, float $earthMargin = 0.0, bool $withSeries = false): array
    {
        $end = $start + (int) round($days * 86400);
        [$sun, $earth, $wStart, $wEnd] = $this->series($site, $start, $end, $step);
        [$h, $info] = $this->horizonFor($site, $mode);
        $m = Metrics::scenario($sun['period_rows'], $earth['period_rows'], $h, $sunMargin, $earthMargin, $start, $end);
        $disc = Metrics::discRange($sun['period_rows'], $earth['period_rows'], $h, $sunMargin, $earthMargin, $start, $end, $m);
        foreach (['sun', 'earth', 'both'] as $b) {
            $m[$b]['disc_range'] = $disc[$b];
        }
        $dsnCached = null;
        if ($this->dsnEnabled()) {
            $d = $this->dsnSpans($wStart, $wEnd);
            $dsnCached = $d['cached'];
            $m['comm'] = Metrics::comm(
                $m['earth']['spans'],
                Metrics::spans($earth['period_rows'], $h, $earthMargin - Metrics::EARTH_RADIUS_DEG),
                Metrics::spans($earth['period_rows'], $h, $earthMargin + Metrics::EARTH_RADIUS_DEG),
                $d['spans'], $start, $end
            );
        }
        $this->fullNights($m, $sun, $earth, $h, $sunMargin, $earthMargin, $wStart, $wEnd, $start, $end, $d['spans'] ?? null);
        $m['power'] = Power::compute($sun['period_rows'], $h, $sunMargin, $start, $end, $this->power, ['rows' => $sun['rows'], 'start' => $wStart, 'end' => $wEnd]);
        // Independent of the chosen period: an 18.6-year average from NASA PGDA 69.
        $m['reference_long_term'] = $this->reference ? $this->reference->longTerm($site) : ['available' => false, 'reason' => 'Reference data not installed.'];
        $out = [
            'site' => $site,
            'metrics' => $m,
            'provenance' => $this->provenance($site, $sun, $earth, $info, $step, ['sun' => $sunMargin, 'earth' => $earthMargin])
                + ['dsn' => $this->dsnProvenance($dsnCached), 'power' => Power::provenance($this->power)],
        ];
        if ($withSeries) {
            $out['series'] = ['sun' => $sun['period_rows'], 'earth' => $earth['period_rows']];
        }
        return $out;
    }

    /** @param list<array{site:array,start:int,days:float,label?:string}> $specs */
    public function compare(array $specs, int $step, string $mode, float $sunMargin, float $earthMargin): array
    {
        if (count($specs) < 1 || count($specs) > 4) {
            throw new InvalidArgumentException('Compare 1 to 4 scenarios.');
        }
        $results = [];
        foreach ($specs as $i => $s) {
            $r = $this->run($s['site'], $s['start'], (int) $s['days'], $step, $mode, $sunMargin, $earthMargin);
            $r['label'] = $s['label'] ?? ('S' . ($i + 1));
            $results[] = $r;
        }
        $rows = [];
        $bodies = ['sun' => 'fraction', 'earth' => 'fraction', 'both' => 'fraction'];
        if (array_reduce($results, static fn($ok, $r) => $ok && isset($r['metrics']['comm']), true)) {
            $bodies['comm'] = 'fraction';
        }
        foreach ($bodies as $body => $k) {
            $vals = array_map(static fn($r) => $r['metrics'][$body][$k], $results);
            $best = array_keys($vals, max($vals));
            $rows[$body] = ['values' => $vals, 'best' => count($best) === count($vals) ? null : $best];
        }
        return ['scenarios' => $results, 'summary' => $rows];
    }

    public function delay(array $site, int $start, int $days, float $delayDays, int $step, string $mode, float $sunMargin, float $earthMargin): array
    {
        $shift = (int) round($delayDays * 86400);
        $c = $this->compare([
            ['site' => $site, 'start' => $start, 'days' => $days, 'label' => 'original'],
            ['site' => $site, 'start' => $start + $shift, 'days' => $days, 'label' => 'delayed'],
        ], $step, $mode, $sunMargin, $earthMargin);
        $o = $c['scenarios'][0]['metrics'];
        $d = $c['scenarios'][1]['metrics'];
        $c['delta'] = [
            'sun_hours' => round($d['sun']['hours'] - $o['sun']['hours'], 2),
            'earth_hours' => round($d['earth']['hours'] - $o['earth']['hours'], 2),
            'both_hours' => round($d['both']['hours'] - $o['both']['hours'], 2),
            'longest_dark_h' => round($d['sun']['longest_hidden_h'] - $o['sun']['longest_hidden_h'], 2),
        ];
        $c['delta']['battery_kwh'] = round($d['power']['battery_kwh'] - $o['power']['battery_kwh'], 3);
        $c['delta']['battery_kg'] = round($d['power']['battery_kg'] - $o['power']['battery_kg'], 2);
        $c['delta']['energy_wh_per_day'] = round($d['power']['energy_wh_per_day'] - $o['power']['energy_wh_per_day'], 1);
        // A change between minimums is not itself a bound in either direction: flag it.
        $c['delta']['battery_from_lower_bound'] = $o['power']['lower_bound'] || $d['power']['lower_bound'];
        if (isset($o['comm'], $d['comm'])) {
            $c['delta']['comm_hours'] = round($d['comm']['hours'] - $o['comm']['hours'], 2);
            $c['delta']['longest_comm_gap_h'] = round($d['comm']['longest_gap_h'] - $o['comm']['longest_gap_h'], 2);
        }
        $c['delay_days'] = $delayDays;
        return $c;
    }

    /**
     * Scans landing dates between $from and $to (every $stepHours) and returns the ones
     * whose following $durationDays meet the constraints. One ephemeris request covers all.
     */
    public function searchWindows(array $site, int $from, int $to, float $durationDays, array $constraints, int $stepHours, int $step, string $mode, float $sunMargin, float $earthMargin): array
    {
        $dur = (int) round($durationDays * 86400);
        $candidates = (int) floor(($to - $from) / ($stepHours * 3600)) + 1;
        if ($candidates > 400) {
            throw new InvalidArgumentException('Search too large: reduce the range or increase the step.');
        }
        if (isset($constraints['min_comm_hours_per_day']) && !$this->dsnEnabled()) {
            throw new InvalidArgumentException('min_comm_hours_per_day needs DSN contact (dsn=1).');
        }
        [$sun, $earth, $wStart, $wEnd] = $this->series($site, $from, $to + $dur, $step);
        [$h, $info] = $this->horizonFor($site, $mode);
        $dsn = $this->dsnEnabled() ? $this->dsnSpans($wStart, $wEnd) : null;
        // Nights overlapping each candidate stay are measured in full within the extended window.
        $sunSpansW = Metrics::spans($sun['rows'], $h, $sunMargin);
        $ext = ['rows' => $sun['rows'], 'start' => $wStart, 'end' => $wEnd];
        $matches = [];
        $scanned = [];
        for ($t = $from; $t <= $to; $t += $stepHours * 3600) {
            $m = Metrics::scenario(Metrics::slice($sun['rows'], $t, $t + $dur), Metrics::slice($earth['rows'], $t, $t + $dur), $h, $sunMargin, $earthMargin, $t, $t + $dur);
            $comm = $dsn ? Metrics::comm($m['earth']['spans'], [], [], $dsn['spans'], $t, $t + $dur) : null;
            [$nightS, $nightB] = Metrics::longestGapOverlapping($sunSpansW, $wStart, $wEnd, $t, $t + $dur);
            $m['sun']['longest_hidden_h'] = round($nightS / 3600, 2);
            $m['sun']['longest_hidden_lower_bound'] = $nightB;
            $pw = Power::budget(Metrics::slice($sun['rows'], $t, $t + $dur), $h, $sunMargin, $t, $t + $dur, $this->power, $ext);
            $ok = $m['sun']['fraction'] >= ($constraints['min_sun_fraction'] ?? 0)
                && $m['earth']['fraction'] >= ($constraints['min_earth_fraction'] ?? 0)
                && $m['earth']['hours_per_day'] >= ($constraints['min_earth_hours_per_day'] ?? 0)
                && $m['both']['fraction'] >= ($constraints['min_both_fraction'] ?? 0)
                && $m['sun']['longest_hidden_h'] <= ($constraints['max_dark_hours'] ?? INF)
                && ($comm === null || $comm['hours_per_day'] >= ($constraints['min_comm_hours_per_day'] ?? 0))
                && $pw['battery_kwh'] <= ($constraints['max_battery_kwh'] ?? INF);
            $row = [
                'start' => $t,
                'sun_fraction' => $m['sun']['fraction'],
                'earth_fraction' => $m['earth']['fraction'],
                'earth_hours_per_day' => $m['earth']['hours_per_day'],
                'both_fraction' => $m['both']['fraction'],
                'longest_dark_h' => $m['sun']['longest_hidden_h'],
                'longest_dark_lower_bound' => $m['sun']['longest_hidden_lower_bound'],
                'comm_fraction' => $comm['fraction'] ?? null,
                'comm_hours_per_day' => $comm['hours_per_day'] ?? null,
                'energy_wh_per_day' => $pw['energy_wh_per_day'],
                'battery_kwh' => $pw['battery_kwh'],
                'battery_lower_bound' => $pw['lower_bound'],
                'meets' => $ok,
            ];
            $scanned[] = $row;
            if ($ok) $matches[] = $row;
        }
        return [
            'site' => $site,
            'constraints' => $constraints,
            'duration_days' => $durationDays,
            'first_match' => $matches[0] ?? null,
            'matches' => array_slice($matches, 0, 50),
            'scanned' => $scanned,
            'provenance' => $this->provenance($site, $sun, $earth, $info, $step, ['sun' => $sunMargin, 'earth' => $earthMargin])
                + ['dsn' => $this->dsnProvenance($dsn['cached'] ?? null), 'power' => Power::provenance($this->power)],
        ];
    }

    /**
     * Sensitivity map: metrics on a grid of points around a catalogue site, each with
     * its own terrain mask. Directions are transferred from the centre site.
     */
    public function sensitivity(array $site, int $start, int $days, int $step, float $sunMargin, float $earthMargin): array
    {
        $grid = $site['id'] !== 'custom' ? $this->terrain->grid($site['id']) : null;
        if ($grid === null) {
            return ['site' => $site, 'available' => false] + self::noGrid($site);
        }
        $end = $start + $days * 86400;
        [$sun, $earth, $wStart, $wEnd] = $this->series($site, $start, $end, $step);
        // DSN coverage does not depend on the point: one union for the whole grid.
        $dsn = $this->dsnEnabled() ? $this->dsnSpans($wStart, $wEnd) : null;
        $union = $dsn ? Metrics::intersect(Metrics::union(array_values($dsn['spans'])), [[$start, $end]]) : null;
        $points = [];
        foreach (array_slice($grid['points'], 0, 225) as $p) {
            $to = ['lat' => $p['lat'], 'lon' => $p['lon']];
            $mask = HorizonMask::fromArray(['az_step_deg' => $p['az_step_deg'] ?? $grid['az_step_deg'], 'elevations' => $p['elevations']]);
            $h = static fn(float $az): float => $mask->at($az);
            $sW = Frames::transferSeries($sun['rows'], $site, $to); // extended window, for the night
            $s = Metrics::slice($sW, $start, $end);
            $e = Frames::transferSeries($earth['period_rows'], $site, $to);
            $m = Metrics::scenario($s, $e, $h, $sunMargin, $earthMargin, $start, $end);
            $pw = Power::budget($s, $h, $sunMargin, $start, $end, $this->power, ['rows' => $sW, 'start' => $wStart, 'end' => $wEnd]);
            $points[] = [
                'dx_m' => $p['dx_m'], 'dy_m' => $p['dy_m'], 'lat' => $p['lat'], 'lon' => $p['lon'],
                'sun_fraction' => $m['sun']['fraction'],
                'earth_fraction' => $m['earth']['fraction'],
                'both_fraction' => $m['both']['fraction'],
                'energy_wh_per_day' => $pw['energy_wh_per_day'],
                'longest_night_h' => $pw['longest_night_h'],
                'battery_kwh' => $pw['battery_kwh'],
                'night_lower_bound' => $pw['lower_bound'],
            ] + ($union !== null ? ['comm_fraction' => round(Metrics::totalSeconds(Metrics::intersect($m['earth']['spans'], $union)) / max(1, $end - $start), 4)] : []);
        }
        return [
            'site' => $site,
            'available' => true,
            'spacing_m' => $grid['spacing_m'] ?? null,
            'points' => $points,
            'summary' => self::spreadSummary($points, (float) ($grid['spacing_m'] ?? 0)),
            'provenance' => $this->provenance($site, $sun, $earth, ['mode' => 'terrain', 'terrain' => 'grid', 'mask' => $grid['meta'] ?? []], $step, ['sun' => $sunMargin, 'earth' => $earthMargin])
                + ['dsn' => $this->dsnProvenance($dsn['cached'] ?? null), 'power' => Power::provenance($this->power)],
        ];
    }

    /** Why a site has no sensitivity grid: custom coordinates, or a site outside the LOLA polar DEMs. */
    private static function noGrid(array $site): array
    {
        return $site['id'] === 'custom'
            ? ['reason_code' => 'custom_site', 'reason' => 'Custom coordinates have no precomputed terrain grid; choose a catalogue site.']
            : ['reason_code' => 'no_terrain', 'reason' => 'Terrain data is not available for this site (outside the LOLA polar DEMs).'];
    }

    /** P10, median and P90 of the grid points within SPREAD_RADIUS_M of the site (dx, dy distance). */
    public static function spreadSummary(array $points, float $spacing): array
    {
        $near = array_values(array_filter($points, static fn($p) => hypot($p['dx_m'], $p['dy_m']) <= self::SPREAD_RADIUS_M + 1e-6));
        if (!$near) {
            return ['available' => false, 'reason' => 'No grid point within ' . (int) self::SPREAD_RADIUS_M . ' m of the site.'];
        }
        $stats = static fn(string $k) => [
            'p10' => round(Metrics::percentile(array_column($near, $k), 10), 4),
            'median' => round(Metrics::percentile(array_column($near, $k), 50), 4),
            'p90' => round(Metrics::percentile(array_column($near, $k), 90), 4),
        ];
        $out = [
            'available' => true,
            'radius_m' => self::SPREAD_RADIUS_M,
            'spacing_m' => $spacing,
            'points' => count($near),
            'sun' => $stats('sun_fraction'),
            'earth' => $stats('earth_fraction'),
            'both' => $stats('both_fraction'),
        ];
        if (isset($near[0]['comm_fraction'])) {
            $out['comm'] = $stats('comm_fraction');
        }
        if (isset($near[0]['energy_wh_per_day'])) {
            $out['energy_wh_per_day'] = $stats('energy_wh_per_day');
        }
        // Night and battery: a percentile is a minimum if any point it uses is one.
        foreach (['longest_night_h', 'battery_kwh'] as $k) {
            if (!isset($near[0][$k])) continue;
            $vals = array_column($near, $k);
            $flags = array_map(static fn($p) => !empty($p['night_lower_bound']), $near);
            $s = [];
            $lb = [];
            foreach (['p10' => 10, 'median' => 50, 'p90' => 90] as $name => $pc) {
                [$v, $b] = Metrics::percentileBound($vals, $flags, $pc);
                $s[$name] = round($v, 4);
                $lb[$name] = $b;
            }
            $out[$k] = $s + ['lower_bound' => $lb];
        }
        return $out;
    }

    /**
     * Position spread for /metrics?spread=1 and the Analyst: the sensitivity summary,
     * cached per site, period, step, margins and grid file. Uses the same ephemeris
     * series as the site itself, so it never adds Horizons requests.
     */
    public function positionSpread(array $site, int $start, int $days, int $step, float $sunMargin, float $earthMargin): array
    {
        $version = $site['id'] !== 'custom' ? $this->terrain->gridVersion($site['id']) : null;
        if ($version === null) {
            return ['available' => false] + self::noGrid($site);
        }
        $dsnKey = $this->dsnEnabled() ? [$this->dsnMinEl, $this->dsn->stepMinutes()] : 'off';
        $key = 'spread:v5:' . json_encode([$site['id'], $start, $days, $step, $sunMargin, $earthMargin, self::SPREAD_RADIUS_M, $version, $dsnKey, $this->power, self::NIGHT_EXT_DAYS]);
        $hit = $this->cache?->get($key);
        if ($hit !== null && isset($hit['available'])) {
            return $hit;
        }
        $s = $this->sensitivity($site, $start, $days, $step, $sunMargin, $earthMargin);
        $summary = $s['available'] ? $s['summary'] : ['available' => false, 'reason_code' => $s['reason_code'] ?? 'no_terrain', 'reason' => $s['reason'] ?? 'unavailable'];
        $this->cache?->set($key, $summary);
        return $summary;
    }
}
