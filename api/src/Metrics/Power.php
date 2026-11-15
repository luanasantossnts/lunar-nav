<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Metrics;

/**
 * Illustrative power and battery budget from the Sun series of a scenario.
 *
 * Energy = P × factor(el) integrated over the visible part of each sample interval,
 * with the same integration as panel_factor (Metrics::panelIntegral). P is the panel's
 * nominal power with the Sun perpendicular at 1361 W/m². The battery must carry the
 * survival load through the longest night: capacity = survival W × night h / DoD.
 * Not a specification of any real mission: every input is visible and editable.
 */
final class Power
{
    public const SOLAR_CONSTANT_W_M2 = 1361.0;
    public const ORIENTATIONS = ['vertical_tracking', 'horizontal'];
    public const DEFAULTS = [
        'panel_w' => 400.0,
        'orientation' => 'vertical_tracking',
        'load_w' => 150.0,
        'survival_w' => 60.0,
        'dod' => 0.8,
        'wh_per_kg' => 150.0,
    ];
    /** Accepted ranges; values outside are clamped and the effective value is reported. */
    public const LIMITS = [
        'panel_w' => [1.0, 100000.0],
        'load_w' => [0.0, 100000.0],
        'survival_w' => [0.0, 100000.0],
        'dod' => [0.1, 1.0],
        'wh_per_kg' => [50.0, 500.0],
    ];
    public const ASSUMPTIONS = [
        'Sun–Moon distance taken as 1 AU (the ±3.4% yearly variation of sunlight is ignored)',
        'No dust and no panel degradation',
        'No thermal model (heater power is part of the survival load you enter)',
        'Panel not shadowed by the lander itself',
        'Illustrative inputs, not the specification of any real mission',
    ];

    /** Defaults, overridden by valid inputs and clamped to LIMITS. */
    public static function params(array $in): array
    {
        $p = self::DEFAULTS;
        foreach (self::LIMITS as $k => [$lo, $hi]) {
            if (isset($in[$k]) && is_numeric($in[$k])) {
                $p[$k] = max($lo, min($hi, (float) $in[$k]));
            }
        }
        if (isset($in['orientation']) && in_array($in['orientation'], self::ORIENTATIONS, true)) {
            $p['orientation'] = $in['orientation'];
        }
        return $p;
    }

    /** Battery capacity (Wh) to carry the survival load through the longest night. */
    public static function batteryWh(float $survivalW, float $nightH, float $dod): float
    {
        return $survivalW * $nightH / $dod;
    }

    /**
     * Budget for one Sun visibility condition (margin), with the night given in hours.
     * @param callable(float):float $horizon
     */
    public static function budget(array $sunRows, callable $horizon, float $margin, int $start, int $end, array $p, ?array $ext = null): array
    {
        $period = max(1, $end - $start);
        $days = $period / 86400;
        $orient = $p['orientation'] === 'horizontal' ? 'horizontal' : 'vertical';
        $minFactor = $p['panel_w'] > 0 ? $p['load_w'] / $p['panel_w'] : INF;
        $pi = Metrics::panelIntegral($sunRows, $horizon, $margin, $minFactor, $orient);
        $energy = $p['panel_w'] * $pi[$orient] / 3600;
        // Night: measured in full over the extended window when given (nights that overlap the
        // period); energy and deficit use the period only.
        $info = $ext !== null
            ? Metrics::longestGapOverlapping(Metrics::spans($ext['rows'], $horizon, $margin), $ext['start'], $ext['end'], $start, $end)
            : Metrics::longestGapInfo(Metrics::spans($sunRows, $horizon, $margin), $start, $end) + [2 => null, 3 => null];
        [$nightS, $bound] = $info;
        $night = $nightS / 3600;
        $battery = self::batteryWh($p['survival_w'], $night, $p['dod']);
        // Deficit: any time the panel delivers less than the operating load (all of the
        // night, plus low-Sun stretches). With no load there is never a deficit.
        $deficit = $p['load_w'] <= 0 ? 0.0 : 1 - $pi['above'] / $period;
        return [
            'energy_wh' => round($energy, 1),
            'energy_wh_per_day' => round($energy / $days, 1),
            'balance_wh_per_day' => round($energy / $days - $p['load_w'] * 24, 1),
            'longest_night_h' => round($night, 2),
            'night_is_whole_period' => $night * 3600 >= $period - 1,
            // The longest night touches the edge of the window it was measured in, so it may be
            // longer: the night, and the battery and mass derived from it, are minimums.
            'lower_bound' => $bound,
            'night_placement' => Metrics::gapPlacement($info, $start, $end),
            'battery_wh' => round($battery, 1),
            'battery_kwh' => round($battery / 1000, 3),
            'battery_kg' => round($battery / $p['wh_per_kg'], 2),
            'deficit_fraction' => round(max(0.0, min(1.0, $deficit)), 4),
            'panel_factor' => round($pi[$orient] / $period, 4),
        ];
    }

    /**
     * Full power block: centre value plus the solar-disc range (first limb … full disc).
     * @param callable(float):float $horizon
     */
    public static function compute(array $sunRows, callable $horizon, float $sunMargin, int $start, int $end, array $p, ?array $ext = null): array
    {
        $centre = self::budget($sunRows, $horizon, $sunMargin, $start, $end, $p, $ext);
        $first = self::budget($sunRows, $horizon, $sunMargin - Metrics::SUN_RADIUS_DEG, $start, $end, $p, $ext);
        $full = self::budget($sunRows, $horizon, $sunMargin + Metrics::SUN_RADIUS_DEG, $start, $end, $p, $ext);
        $pick = static fn(array $b) => array_intersect_key($b, array_flip(['energy_wh_per_day', 'balance_wh_per_day', 'longest_night_h', 'battery_kwh', 'battery_kg', 'deficit_fraction', 'lower_bound']));
        return $centre + [
            'params' => $p,
            'disc_range' => ['first_limb' => $pick($first), 'centre' => $pick($centre), 'full_disc' => $pick($full), 'radius_deg' => Metrics::SUN_RADIUS_DEG],
        ];
    }

    public static function provenance(array $p): array
    {
        return [
            'params' => $p,
            'nominal' => sprintf('panel_w is the output with the Sun perpendicular to the panel at %.0f W/m²', self::SOLAR_CONSTANT_W_M2),
            'factor' => $p['orientation'] === 'horizontal' ? 'sin(elevation), horizontal panel' : 'cos(elevation), vertical panel that turns to face the Sun',
            'battery' => 'survival_w × longest night / dod; mass = capacity / wh_per_kg',
            'integration' => 'same interval integration as panel_factor (visible part of each sample interval, elevation at its midpoint)',
            'assumptions' => self::ASSUMPTIONS,
        ];
    }
}
