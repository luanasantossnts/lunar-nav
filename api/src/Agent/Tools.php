<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Agent;

use InvalidArgumentException;
use LunarNav\Metrics\Scenarios;
use LunarNav\Sites\SiteCatalog;

/**
 * Tools the Analyst may call. Each one runs the same code the planner uses and
 * returns a compact summary (no raw series) so the model only ever sees numbers
 * the system computed.
 */
final class Tools
{
    public function __construct(private SiteCatalog $sites, private Scenarios $scenarios)
    {
    }

    /** Provider-neutral tool definitions (name, description, JSON schema). */
    public static function definitions(): array
    {
        $date = ['type' => 'string', 'description' => 'UTC date, YYYY-MM-DD or YYYY-MM-DDTHH:MM'];
        $mode = ['type' => 'string', 'enum' => ['geometric', 'terrain'], 'description' => 'Horizon model. terrain uses a NASA LOLA mask when one exists for the site, otherwise the result says terrain is unavailable.'];
        $site = ['type' => 'string', 'description' => 'Catalogue site id from list_sites'];
        return [
            [
                'name' => 'list_sites',
                'description' => 'List catalogue landing sites with coordinates, programme and coordinate source.',
                'schema' => ['type' => 'object', 'properties' => ['region' => ['type' => 'string', 'enum' => ['south_pole', 'south_high_latitude', 'near_side']]]],
            ],
            [
                'name' => 'site_metrics',
                'description' => 'Sunlight, Earth visibility, overlap, longest dark period, next sunset/Earthset and elevation ranges for one site and period, from JPL Horizons. Also comm: contact with Earth, i.e. Earth in view from the site AND at least one NASA Deep Space Network 70-m complex (Goldstone, Canberra, Madrid) seeing the Moon above the minimum elevation, with the longest gap without contact and per-station coverage. Each fraction comes with disc_range (first limb … full disc) and, when the site has a terrain grid, position_spread (P10–P90 of points within 300 m, terrain horizon).',
                'schema' => ['type' => 'object', 'properties' => ['site' => $site, 'start' => $date, 'days' => ['type' => 'number'], 'mode' => $mode, 'earth_margin_deg' => ['type' => 'number'], 'dsn_min_elevation_deg' => ['type' => 'number', 'description' => 'Minimum Moon elevation at the DSN stations, 0 to 20 (default 10)']], 'required' => ['site', 'start', 'days']],
            ],
            [
                'name' => 'compare_sites',
                'description' => 'Same metrics for 2 to 4 sites over the same period, with the best site per metric.',
                'schema' => ['type' => 'object', 'properties' => ['sites' => ['type' => 'array', 'items' => $site], 'start' => $date, 'days' => ['type' => 'number'], 'mode' => $mode], 'required' => ['sites', 'start', 'days']],
            ],
            [
                'name' => 'delay_impact',
                'description' => 'Compares a landing at start with the same site and duration after a delay, and reports the changes in hours.',
                'schema' => ['type' => 'object', 'properties' => ['site' => $site, 'start' => $date, 'days' => ['type' => 'number'], 'delay_days' => ['type' => 'number'], 'mode' => $mode], 'required' => ['site', 'start', 'days', 'delay_days']],
            ],
            [
                'name' => 'search_dates',
                'description' => 'Scans landing dates in a range (daily) and returns those whose surface stay meets the constraints, including minimum hours per day of DSN contact.',
                'schema' => ['type' => 'object', 'properties' => [
                    'site' => $site, 'from' => $date, 'to' => $date, 'duration_days' => ['type' => 'number'],
                    'min_sun_fraction' => ['type' => 'number', 'description' => '0 to 1'],
                    'min_earth_hours_per_day' => ['type' => 'number'],
                    'min_comm_hours_per_day' => ['type' => 'number', 'description' => 'Minimum hours per day of contact with Earth through the DSN'],
                    'max_battery_kwh' => ['type' => 'number', 'description' => 'Maximum battery capacity (kWh) needed for the longest night, with the default power inputs'],
                    'max_dark_hours' => ['type' => 'number'],
                    'mode' => $mode,
                ], 'required' => ['site', 'from', 'to', 'duration_days']],
            ],
            [
                'name' => 'power_budget',
                'description' => 'Illustrative energy and battery budget for one site and period: energy per day from a solar panel, daily balance against the operating load, longest night, battery capacity (kWh) and mass (kg) to carry a survival load through that night, and the fraction of time in deficit, each with its solar-disc range (and position range in terrain mode when a grid exists). Inputs are assumptions, not a real mission specification.',
                'schema' => ['type' => 'object', 'properties' => [
                    'site' => $site, 'start' => $date, 'days' => ['type' => 'number'], 'mode' => $mode,
                    'panel_w' => ['type' => 'number', 'description' => 'Panel output with the Sun perpendicular at 1361 W/m² (default 400 W)'],
                    'orientation' => ['type' => 'string', 'enum' => ['vertical_tracking', 'horizontal'], 'description' => 'vertical_tracking (default): vertical panel turning to face the Sun; horizontal: flat panel'],
                    'load_w' => ['type' => 'number', 'description' => 'Average operating load (default 150 W)'],
                    'survival_w' => ['type' => 'number', 'description' => 'Survival load through the night (default 60 W)'],
                    'dod' => ['type' => 'number', 'description' => 'Battery depth of discharge 0.1–1 (default 0.8)'],
                    'wh_per_kg' => ['type' => 'number', 'description' => 'Battery pack specific energy (default 150 Wh/kg)'],
                ], 'required' => ['site', 'start', 'days']],
            ],
            [
                'name' => 'sensitivity_map',
                'description' => 'Sunlight and Earth visibility on a grid of points around a site, using terrain masks, to show how much a small move changes the result.',
                'schema' => ['type' => 'object', 'properties' => ['site' => $site, 'start' => $date, 'days' => ['type' => 'number']], 'required' => ['site', 'start', 'days']],
            ],
        ];
    }

    public static function parseDate(string $s): int
    {
        if (preg_match('/^\d{9,11}$/', trim($s))) {
            return (int) trim($s); // Unix seconds, as sent by the front end
        }
        $ts = strtotime(trim($s) . (preg_match('/[zZ]|[+-]\d\d:?\d\d$/', $s) ? '' : ' UTC'));
        if ($ts === false) {
            throw new InvalidArgumentException('Invalid date: ' . $s);
        }
        return $ts;
    }

    public function execute(string $name, array $a): array
    {
        $mode = ($a['mode'] ?? 'geometric') === 'terrain' ? 'terrain' : 'geometric';
        // Each call uses only its own arguments or the defaults: nothing carries over
        // from an earlier tool call in the same conversation.
        $this->scenarios->configureDsn(true, isset($a['dsn_min_elevation_deg']) && is_numeric($a['dsn_min_elevation_deg']) ? (float) $a['dsn_min_elevation_deg'] : null);
        $this->scenarios->configurePower(self::powerArgs($a));
        switch ($name) {
            case 'list_sites':
                $list = array_values(array_filter($this->sites->all(), static fn($s) => empty($a['region']) || $s['region'] === $a['region']));
                return ['sites' => array_map(static fn($s) => array_intersect_key($s, array_flip(['id', 'name', 'region', 'program', 'lat', 'lon', 'status'])), $list)];
            case 'site_metrics':
                $site = $this->sites->resolve(['site' => $a['site'] ?? '']);
                $start = self::parseDate((string) $a['start']);
                $days = self::days($a['days'] ?? 30);
                $earthMargin = (float) ($a['earth_margin_deg'] ?? 0);
                $r = $this->scenarios->run($site, $start, $days, 60, $mode, 0.0, $earthMargin);
                // The ±300 m range uses terrain horizons, so it is attached in terrain mode only.
                if ($mode === 'terrain') {
                    $r['position_spread'] = $this->scenarios->positionSpread($site, $start, $days, 60, 0.0, $earthMargin);
                }
                return self::summarise($r);
            case 'compare_sites':
                $ids = array_slice((array) ($a['sites'] ?? []), 0, 4);
                $start = self::parseDate((string) $a['start']);
                $days = self::days($a['days'] ?? 30);
                $specs = array_map(fn($id) => ['site' => $this->sites->resolve(['site' => $id]), 'start' => $start, 'days' => $days, 'label' => $id], $ids);
                $c = $this->scenarios->compare($specs, 60, $mode, 0.0, 0.0);
                if ($mode === 'terrain') {
                    foreach ($c['scenarios'] as $i => $sc) {
                        $c['scenarios'][$i]['position_spread'] = $this->scenarios->positionSpread($specs[$i]['site'], $start, $days, 60, 0.0, 0.0);
                    }
                }
                return ['scenarios' => array_map([self::class, 'summarise'], $c['scenarios']), 'summary' => $c['summary']];
            case 'delay_impact':
                $site = $this->sites->resolve(['site' => $a['site'] ?? '']);
                $c = $this->scenarios->delay($site, self::parseDate((string) $a['start']), self::days($a['days'] ?? 30), (float) ($a['delay_days'] ?? 10), 60, $mode, 0.0, 0.0);
                return ['original' => self::summarise($c['scenarios'][0]), 'delayed' => self::summarise($c['scenarios'][1]), 'delta_hours' => $c['delta'], 'delay_days' => $c['delay_days']];
            case 'search_dates':
                $site = $this->sites->resolve(['site' => $a['site'] ?? '']);
                $r = $this->scenarios->searchWindows($site, self::parseDate((string) $a['from']), self::parseDate((string) $a['to']), (float) ($a['duration_days'] ?? 14), array_filter([
                    'min_sun_fraction' => isset($a['min_sun_fraction']) ? (float) $a['min_sun_fraction'] : null,
                    'min_earth_hours_per_day' => isset($a['min_earth_hours_per_day']) ? (float) $a['min_earth_hours_per_day'] : null,
                    'min_comm_hours_per_day' => isset($a['min_comm_hours_per_day']) ? (float) $a['min_comm_hours_per_day'] : null,
                    'max_battery_kwh' => isset($a['max_battery_kwh']) ? (float) $a['max_battery_kwh'] : null,
                    'max_dark_hours' => isset($a['max_dark_hours']) ? (float) $a['max_dark_hours'] : null,
                ], static fn($v) => $v !== null), 24, 60, $mode, 0.0, 0.0);
                return [
                    'first_match' => self::isoRow($r['first_match']),
                    'matches' => array_map([self::class, 'isoRow'], array_slice($r['matches'], 0, 10)),
                    'scanned' => count($r['scanned']),
                    'horizon' => $r['provenance']['horizon'],
                ];
            case 'power_budget':
                $site = $this->sites->resolve(['site' => $a['site'] ?? '']);
                $start = self::parseDate((string) $a['start']);
                $days = self::days($a['days'] ?? 30);
                $r = $this->scenarios->run($site, $start, $days, 60, $mode, 0.0, 0.0);
                $spread = $mode === 'terrain' ? $this->scenarios->positionSpread($site, $start, $days, 60, 0.0, 0.0) : null;
                $s = self::summarise($r);
                return [
                    'site' => $s['site'],
                    'period' => $s['period'],
                    'horizon' => $s['horizon'],
                    'power' => $s['power'],
                    'position_spread' => $spread && $spread['available'] ? array_intersect_key($spread, array_flip(['radius_m', 'points', 'energy_wh_per_day', 'longest_night_h', 'battery_kwh'])) : null,
                    'note' => 'Illustrative: depends on the inputs and assumptions listed; not a real mission specification.',
                ];
            case 'sensitivity_map':
                $site = $this->sites->resolve(['site' => $a['site'] ?? '']);
                $r = $this->scenarios->sensitivity($site, self::parseDate((string) $a['start']), self::days($a['days'] ?? 30), 60, 0.0, 0.0);
                if (!$r['available']) return $r;
                $sun = array_column($r['points'], 'sun_fraction');
                $earth = array_column($r['points'], 'earth_fraction');
                return [
                    'points' => count($r['points']),
                    'spacing_m' => $r['spacing_m'],
                    'sun_fraction_range' => [min($sun), max($sun)],
                    'earth_fraction_range' => [min($earth), max($earth)],
                    'best_sun_point' => $r['points'][array_search(max($sun), $sun, true)],
                    'within_300_m' => $r['summary'],
                ];
        }
        throw new InvalidArgumentException('Unknown tool: ' . $name);
    }

    /** Power-model inputs from tool arguments (unprefixed names); absent → defaults. */
    private static function powerArgs(array $a): array
    {
        return array_intersect_key($a, array_flip(['panel_w', 'orientation', 'load_w', 'survival_w', 'dod', 'wh_per_kg']));
    }

    private static function days(mixed $d): int
    {
        return max(1, min(60, (int) round((float) $d)));
    }

    private static function isoRow(?array $r): ?array
    {
        if ($r === null) return null;
        $r['start'] = gmdate('Y-m-d\TH:i\Z', $r['start']);
        return $r;
    }

    /** Compact, model-facing summary of one scenario result. */
    public static function summarise(array $r): array
    {
        $m = $r['metrics'];
        $iso = static fn($t) => $t === null ? null : gmdate('Y-m-d\TH:i\Z', $t);
        $b = static fn(array $x) => [
            'fraction' => $x['fraction'],
            'hours' => $x['hours'],
            'hours_per_day' => $x['hours_per_day'],
            'longest_visible_h' => $x['longest_visible_h'],
            'longest_hidden_h' => $x['longest_hidden_h'],
            'longest_hidden_lower_bound' => $x['longest_hidden_lower_bound'] ?? false,
            'longest_hidden_placement' => $x['longest_hidden_placement'] ?? null,
            'first_set' => $iso($x['first_set']),
            'first_rise' => $iso($x['first_rise']),
            'elevation_deg' => $x['elevation'],
            'disc_range' => $x['disc_range'] ?? null,
        ];
        $out = [
            'label' => $r['label'] ?? null,
            'site' => ['id' => $r['site']['id'], 'name' => $r['site']['name'], 'lat' => $r['site']['lat'], 'lon' => $r['site']['lon']],
            'period' => ['start' => $iso($m['period']['start']), 'end' => $iso($m['period']['end'])],
            'sun' => $b($m['sun']),
            'earth' => $b($m['earth']),
            'sun_and_earth' => ['fraction' => $m['both']['fraction'], 'hours' => $m['both']['hours'], 'disc_range' => $m['both']['disc_range'] ?? null],
            'horizon' => $r['provenance']['horizon']['mode'] . ' (' . $r['provenance']['horizon']['terrain'] . ')',
            'visibility' => $r['provenance']['visibility'] ?? 'body centre',
        ];
        if (isset($m['comm'])) {
            $c = $m['comm'];
            $out['comm'] = [
                'meaning' => 'contact with Earth: Earth in view from the site AND a DSN 70-m complex sees the Moon',
                'fraction' => $c['fraction'],
                'hours' => $c['hours'],
                'hours_per_day' => $c['hours_per_day'],
                'longest_gap_h' => $c['longest_gap_h'],
                'longest_gap_lower_bound' => $c['longest_gap_lower_bound'] ?? false,
                'longest_gap_placement' => $c['longest_gap_placement'] ?? null,
                'disc_range' => $c['disc_range'],
                'dsn_union_fraction' => $c['dsn_union']['fraction'],
                'stations' => array_map(static fn($s) => $s['fraction'], $c['stations']),
                'min_elevation_deg' => $r['provenance']['dsn']['min_elevation_deg'] ?? null,
            ];
        }
        if (isset($m['power'])) {
            $p = $m['power'];
            $out['power'] = array_intersect_key($p, array_flip(['energy_wh_per_day', 'balance_wh_per_day', 'longest_night_h', 'battery_kwh', 'battery_kg', 'deficit_fraction', 'lower_bound', 'night_placement', 'params', 'disc_range']))
                + ['assumptions' => $r['provenance']['power']['assumptions'] ?? []];
        }
        if (isset($m['reference_long_term'])) {
            $out['reference_long_term'] = $m['reference_long_term'];
        }
        if (isset($r['position_spread'])) {
            $out['position_spread'] = $r['position_spread'];
        }
        return $out;
    }

    /**
     * The result as the model sees it: every fraction becomes a percentage with one decimal
     * (key "fraction" → "percent", "*_fraction" → "*_percent", P10/median/P90 blocks of a
     * fraction → *_pct), every duration in hours is rounded to one decimal and every elevation
     * or azimuth to two, so the model never has to convert, and never quotes values like 0.9976.
     */
    public static function forModel(mixed $v, ?string $key = null, bool $fractionBlock = false): mixed
    {
        if (is_array($v)) {
            $out = [];
            $isFractionBlock = in_array($key, ['sun', 'earth', 'both', 'comm'], true) && isset($v['p10'], $v['p90']) && !isset($v['fraction']);
            foreach ($v as $k => $x) {
                if (is_string($k)) {
                    [$nk, $kind] = self::modelKey($k, $isFractionBlock || $fractionBlock);
                    if ($kind === 'pct') {
                        $out[$nk] = self::pct($x);
                        continue;
                    }
                    if ($kind === 'h') {
                        $out[$nk] = self::hours($x);
                        continue;
                    }
                    if ($kind === 'deg') {
                        $out[$nk] = self::degrees($x);
                        continue;
                    }
                    $out[$nk] = self::forModel($x, $k);
                } else {
                    $out[$k] = self::forModel($x, $key, $fractionBlock);
                }
            }
            return $out;
        }
        return $v;
    }

    /** @return array{0:string,1:string} new key and kind: 'pct', 'h' or '' (unchanged). */
    private static function modelKey(string $k, bool $fractionBlock): array
    {
        if ($fractionBlock && in_array($k, ['p10', 'median', 'p90'], true)) {
            return [$k . '_pct', 'pct'];
        }
        if ($k === 'stations') return ['stations_percent', 'pct'];
        if ($k === 'fraction') return ['percent', 'pct'];
        if (str_contains($k, 'fraction')) return [str_replace('fraction', 'percent', $k), 'pct'];
        if (preg_match('/^(sun|earth)_(avg|median_300m|p10_p90_300m)$/', $k)) return [$k . '_pct', 'pct'];
        if ($k === 'hours' || $k === 'hours_per_day' || str_ends_with($k, '_h') || str_ends_with($k, '_hours') || str_ends_with($k, '_hours_per_day')) {
            return [$k, 'h'];
        }
        // Elevations and azimuths (not the disc radius, which is a constant): two decimals.
        if ($k === 'elevation' || $k === 'azimuth' || (str_ends_with($k, '_deg') && $k !== 'radius_deg')) {
            return [$k, 'deg'];
        }
        return [$k, ''];
    }

    private static function degrees(mixed $x): mixed
    {
        if (is_array($x)) return array_map([self::class, 'degrees'], $x);
        return is_int($x) || is_float($x) ? round((float) $x, 2) : $x;
    }

    private static function pct(mixed $x): mixed
    {
        if (is_array($x)) return array_map([self::class, 'pct'], $x);
        return is_int($x) || is_float($x) ? round(100 * $x, 1) : $x;
    }

    private static function hours(mixed $x): mixed
    {
        if (is_array($x)) {
            $o = [];
            foreach ($x as $k => $y) $o[$k] = $k === 'lower_bound' ? $y : self::hours($y);
            return $o;
        }
        return is_int($x) || is_float($x) ? round((float) $x, 1) : $x;
    }
}
