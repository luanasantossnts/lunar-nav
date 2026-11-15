<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Metrics;

/**
 * Visibility metrics from az/el series.
 *
 * A body is visible when  elevation − horizon(azimuth) − margin > 0,  where the
 * horizon is 0° (smooth sphere) or a terrain mask. Every quantity is computed per
 * interval between samples, with horizon crossings interpolated linearly, so hours
 * and times are not locked to the sampling step. Visibility uses the body centre;
 * discRange() adds the first-limb and full-disc bounds around it.
 */
final class Metrics
{
    /** Mean apparent angular radius seen from the Moon, degrees. */
    public const SUN_RADIUS_DEG = 0.267;
    public const EARTH_RADIUS_DEG = 0.95;

    /**
     * @param list<array{0:int,1:float,2:float}> $rows
     * @param callable(float):float $horizon skyline elevation for an azimuth
     * @return list<array{0:int,1:int}> visible spans [start, end] in unix seconds
     */
    public static function spans(array $rows, callable $horizon, float $margin = 0.0): array
    {
        $spans = [];
        $n = count($rows);
        if ($n < 2) {
            return $spans;
        }
        $f = [];
        foreach ($rows as $i => $r) {
            $f[$i] = $r[2] - $horizon($r[1]) - $margin;
        }
        for ($i = 1; $i < $n; $i++) {
            $seg = self::aboveSegment($f[$i - 1], $f[$i]);
            if ($seg === null) continue;
            $t0 = $rows[$i - 1][0];
            $dt = $rows[$i][0] - $t0;
            $s = (int) round($t0 + $seg[0] * $dt);
            $e = (int) round($t0 + $seg[1] * $dt);
            if ($e <= $s) continue;
            $last = count($spans) - 1;
            if ($last >= 0 && abs($spans[$last][1] - $s) <= 1) {
                $spans[$last][1] = $e;
            } else {
                $spans[] = [$s, $e];
            }
        }
        return $spans;
    }

    /** Part of an interval (normalised 0–1) where a linearly varying value is > 0. */
    public static function aboveSegment(float $a, float $b): ?array
    {
        if ($a > 0 && $b > 0) return [0.0, 1.0];
        if ($a <= 0 && $b <= 0) return null;
        $c = $a / ($a - $b);
        return $a > 0 ? [0.0, $c] : [$c, 1.0];
    }

    /** Intersection of two sorted span lists. */
    public static function intersect(array $a, array $b): array
    {
        $out = [];
        $i = $j = 0;
        while ($i < count($a) && $j < count($b)) {
            $s = max($a[$i][0], $b[$j][0]);
            $e = min($a[$i][1], $b[$j][1]);
            if ($e > $s) $out[] = [$s, $e];
            if ($a[$i][1] < $b[$j][1]) $i++; else $j++;
        }
        return $out;
    }

    /**
     * Union of several span lists (each sorted), merged into one sorted list.
     * Spans that touch (gap ≤ 1 s) are joined.
     */
    public static function union(array $lists): array
    {
        $all = [];
        foreach ($lists as $l) {
            foreach ($l as $s) $all[] = $s;
        }
        usort($all, static fn($a, $b) => $a[0] <=> $b[0] ?: $a[1] <=> $b[1]);
        $out = [];
        foreach ($all as [$s, $e]) {
            $last = count($out) - 1;
            if ($last >= 0 && $s <= $out[$last][1] + 1) {
                $out[$last][1] = max($out[$last][1], $e);
            } else {
                $out[] = [$s, $e];
            }
        }
        return $out;
    }

    /**
     * Contact with Earth: Earth in view from the site ∩ union of DSN stations that see
     * the Moon. $stationSpans maps station id → its visible spans within [start, end].
     * $earthFirst/$earthFull are Earth's first-limb and full-disc spans for the range.
     */
    public static function comm(array $earthSpans, array $earthFirst, array $earthFull, array $stationSpans, int $start, int $end): array
    {
        $period = max(1, $end - $start);
        $window = [[$start, $end]];
        $union = self::intersect(self::union(array_values($stationSpans)), $window);
        $comm = self::intersect($earthSpans, $union);
        $pack = static fn(array $spans) => [
            'fraction' => round(self::totalSeconds($spans) / $period, 4),
            'hours' => round(self::totalSeconds($spans) / 3600, 2),
        ];
        $stations = [];
        foreach ($stationSpans as $id => $spans) {
            $clip = self::intersect($spans, $window);
            $stations[$id] = $pack($clip) + ['spans' => $clip];
        }
        $centre = $pack($comm);
        return $centre + [
            'hours_per_day' => round(self::totalSeconds($comm) / 3600 / ($period / 86400), 2),
            'longest_gap_h' => round(self::longestGap($comm, $start, $end) / 3600, 2),
            'longest_gap_lower_bound' => self::longestGapInfo($comm, $start, $end)[1],
            'spans' => $comm,
            'stations' => $stations,
            'dsn_union' => $pack($union) + ['spans' => $union],
            'disc_range' => [
                'first_limb' => $pack(self::intersect($earthFirst, $union)),
                'centre' => $centre,
                'full_disc' => $pack(self::intersect($earthFull, $union)),
                'radius_deg' => self::EARTH_RADIUS_DEG,
            ],
        ];
    }

    public static function totalSeconds(array $spans): int
    {
        $t = 0;
        foreach ($spans as $s) $t += $s[1] - $s[0];
        return $t;
    }

    /** Longest gap without visibility inside [start, end]. */
    public static function longestGap(array $spans, int $start, int $end): int
    {
        $cursor = $start;
        $max = 0;
        foreach ($spans as $s) {
            $max = max($max, $s[0] - $cursor);
            $cursor = max($cursor, $s[1]);
        }
        return max($max, $end - $cursor);
    }

    /**
     * Longest gap and whether it is only a lower bound: true when that gap touches the
     * start or the end of the period (it may continue outside what was analysed). When
     * several gaps share the longest length, any one touching an edge makes it a bound.
     * @return array{0:int,1:bool} seconds, lower_bound
     */
    public static function longestGapInfo(array $spans, int $start, int $end): array
    {
        $gaps = [];
        $cursor = $start;
        foreach ($spans as $s) {
            $gaps[] = $s[0] - $cursor;
            $cursor = max($cursor, $s[1]);
        }
        $gaps[] = $end - $cursor;
        $last = count($gaps) - 1;
        $max = 0;
        $bound = false;
        foreach ($gaps as $i => $len) {
            $edge = $i === 0 || $i === $last; // before the first span, or after the last one
            if ($len > $max) {
                $max = $len;
                $bound = $edge;
            } elseif ($len === $max && $len > 0 && $edge) {
                $bound = true;
            }
        }
        return [max(0, $max), $max > 0 && $bound];
    }

    /**
     * Longest gap among those that OVERLAP the period [start, end], each measured in full
     * within a wider window [wStart, wEnd] (the period extended on both sides). A gap is a
     * lower bound only when it touches the edge of that wider window.
     * $spans are the visible spans computed over the whole window.
     * @return array{0:int,1:bool,2:?int,3:?int} seconds, lower_bound, gap start, gap end
     */
    public static function longestGapOverlapping(array $spans, int $wStart, int $wEnd, int $start, int $end): array
    {
        $gaps = [];
        $cursor = $wStart;
        foreach ($spans as $s) {
            if ($s[0] > $cursor) $gaps[] = [$cursor, $s[0]];
            $cursor = max($cursor, $s[1]);
        }
        if ($wEnd > $cursor) $gaps[] = [$cursor, $wEnd];
        $max = 0;
        $bound = false;
        $where = [null, null];
        foreach ($gaps as [$a, $b]) {
            if ($b <= $start || $a >= $end) continue; // does not overlap the period
            $len = $b - $a;
            $edge = $a <= $wStart || $b >= $wEnd;
            if ($len > $max) {
                $max = $len;
                $bound = $edge;
                $where = [$a, $b];
            } elseif ($len === $max && $edge) {
                $bound = true;
            }
        }
        return [$max, $max > 0 && $bound, $where[0], $where[1]];
    }

    /** Where the measured gap lies relative to the period (for explanations). */
    public static function gapPlacement(array $info, int $start, int $end): array
    {
        return [
            'started_before_period' => $info[2] !== null && $info[2] < $start,
            'ends_after_period' => $info[3] !== null && $info[3] > $end,
        ];
    }

    /** Amplitude of azimuths on the circle (handles the 359° → 0° wrap). */
    public static function azimuthArc(array $azimuths): array
    {
        $a = array_map(static fn($x) => fmod(fmod((float) $x, 360.0) + 360.0, 360.0), $azimuths);
        sort($a);
        $n = count($a);
        if ($n < 2) {
            return ['span' => 0.0, 'from' => $a[0] ?? 0.0, 'to' => $a[0] ?? 0.0];
        }
        $maxGap = $a[0] + 360 - $a[$n - 1];
        $gapEnd = 0;
        for ($i = 1; $i < $n; $i++) {
            $g = $a[$i] - $a[$i - 1];
            if ($g > $maxGap) { $maxGap = $g; $gapEnd = $i; }
        }
        return [
            'span' => round(360 - $maxGap, 1),
            'from' => round($a[$gapEnd], 1),
            'to' => round($a[($gapEnd - 1 + $n) % $n], 1),
        ];
    }

    /**
     * Interval integration behind panel_factor and the power model: over the visible part
     * of each sample interval, ∫cos(el)·dt (vertical panel facing the Sun) and ∫sin(el)·dt
     * (horizontal panel), with el taken at the interval midpoint. Also returns the visible
     * seconds and, if $minFactor is given, the visible seconds whose factor for
     * $orientation reaches it (used for the deficit fraction).
     * @param callable(float):float $horizon
     * @return array{vertical:float,horizontal:float,visible:float,above:float}
     */
    public static function panelIntegral(array $rows, callable $horizon, float $margin, ?float $minFactor = null, string $orientation = 'vertical'): array
    {
        $vert = $horiz = $visible = $above = 0.0;
        for ($i = 1, $n = count($rows); $i < $n; $i++) {
            $dt = $rows[$i][0] - $rows[$i - 1][0];
            $fa = $rows[$i - 1][2] - $horizon($rows[$i - 1][1]) - $margin;
            $fb = $rows[$i][2] - $horizon($rows[$i][1]) - $margin;
            $seg = self::aboveSegment($fa, $fb);
            if ($seg === null) continue;
            $frac = $seg[1] - $seg[0];
            $elMid = deg2rad(($rows[$i - 1][2] + $rows[$i][2]) / 2);
            $cv = max(0.0, cos($elMid));
            $ch = max(0.0, sin($elMid));
            $vert += $dt * $frac * $cv;
            $horiz += $dt * $frac * $ch;
            $visible += $dt * $frac;
            if ($minFactor !== null && ($orientation === 'horizontal' ? $ch : $cv) >= $minFactor) {
                $above += $dt * $frac;
            }
        }
        return ['vertical' => $vert, 'horizontal' => $horiz, 'visible' => $visible, 'above' => $above];
    }

    /**
     * Full metric set for one body.
     * @param callable(float):float $horizon
     */
    public static function body(array $rows, callable $horizon, float $margin, int $start, int $end): array
    {
        $spans = self::spans($rows, $horizon, $margin);
        $period = max(1, $end - $start);
        $visible = self::totalSeconds($spans);
        $els = array_column($rows, 2);
        $longestOn = 0;
        foreach ($spans as $s) $longestOn = max($longestOn, $s[1] - $s[0]);

        [, $hiddenBound] = self::longestGapInfo($spans, $start, $end);
        $rise = $set = null;
        foreach ($spans as $s) {
            if ($set === null && $s[1] < $end) $set = $s[1];
            if ($rise === null && $s[0] > $start) $rise = $s[0];
        }

        // Relative panel factors: mean of cos(el) (vertical panel facing the Sun)
        // and sin(el) (horizontal panel) while the Sun is visible. Geometry only.
        $pi = self::panelIntegral($rows, $horizon, $margin);
        $vert = $pi['vertical'];
        $horiz = $pi['horizontal'];

        $arc = self::azimuthArc(array_column($rows, 1));
        return [
            'fraction' => round($visible / $period, 4),
            'hours' => round($visible / 3600, 2),
            'hours_per_day' => round($visible / 3600 / ($period / 86400), 2),
            'spans' => $spans,
            'longest_visible_h' => round($longestOn / 3600, 2),
            'longest_hidden_h' => round(self::longestGap($spans, $start, $end) / 3600, 2),
            'longest_hidden_lower_bound' => $hiddenBound,
            'first_set' => $set,
            'first_rise' => $rise,
            'elevation' => [
                'min' => round(min($els), 3),
                'max' => round(max($els), 3),
                'mean' => round(array_sum($els) / count($els), 3),
            ],
            'azimuth_arc' => $arc,
            'panel_factor' => [
                'vertical' => round($vert / $period, 4),
                'horizontal' => round($horiz / $period, 4),
            ],
        ];
    }

    /**
     * Sun + Earth metrics for one scenario.
     * @param callable(float):float $horizon
     */
    public static function scenario(array $sun, array $earth, callable $horizon, float $sunMargin, float $earthMargin, int $start, int $end): array
    {
        $s = self::body($sun, $horizon, $sunMargin, $start, $end);
        $e = self::body($earth, $horizon, $earthMargin, $start, $end);
        $both = self::intersect($s['spans'], $e['spans']);
        $period = max(1, $end - $start);
        return [
            'sun' => $s,
            'earth' => $e,
            'both' => [
                'fraction' => round(self::totalSeconds($both) / $period, 4),
                'hours' => round(self::totalSeconds($both) / 3600, 2),
                'spans' => $both,
            ],
            'period' => ['start' => $start, 'end' => $end, 'hours' => round($period / 3600, 2)],
        ];
    }

    /**
     * Range of visibility between "any part of the disc above the horizon" (first limb,
     * margin − r) and "the whole disc above it" (full disc, margin + r). Uses the same
     * series and horizon as scenario(); $centre is that result, copied unchanged.
     * @param callable(float):float $horizon
     */
    public static function discRange(array $sun, array $earth, callable $horizon, float $sunMargin, float $earthMargin, int $start, int $end, array $centre): array
    {
        $period = max(1, $end - $start);
        $pack = static fn(array $spans) => [
            'fraction' => round(self::totalSeconds($spans) / $period, 4),
            'hours' => round(self::totalSeconds($spans) / 3600, 2),
        ];
        $sunFirst = self::spans($sun, $horizon, $sunMargin - self::SUN_RADIUS_DEG);
        $sunFull = self::spans($sun, $horizon, $sunMargin + self::SUN_RADIUS_DEG);
        $earthFirst = self::spans($earth, $horizon, $earthMargin - self::EARTH_RADIUS_DEG);
        $earthFull = self::spans($earth, $horizon, $earthMargin + self::EARTH_RADIUS_DEG);
        $c = static fn(array $b) => ['fraction' => $b['fraction'], 'hours' => $b['hours']];
        return [
            'sun' => ['first_limb' => $pack($sunFirst), 'centre' => $c($centre['sun']), 'full_disc' => $pack($sunFull), 'radius_deg' => self::SUN_RADIUS_DEG],
            'earth' => ['first_limb' => $pack($earthFirst), 'centre' => $c($centre['earth']), 'full_disc' => $pack($earthFull), 'radius_deg' => self::EARTH_RADIUS_DEG],
            'both' => [
                'first_limb' => $pack(self::intersect($sunFirst, $earthFirst)),
                'centre' => $c($centre['both']),
                'full_disc' => $pack(self::intersect($sunFull, $earthFull)),
                'radius_deg' => ['sun' => self::SUN_RADIUS_DEG, 'earth' => self::EARTH_RADIUS_DEG],
            ],
        ];
    }

    /** Linear-interpolated percentile (0–100) of a non-empty list, as numpy's default. */
    public static function percentile(array $values, float $p): float
    {
        sort($values);
        $n = count($values);
        if ($n === 1) return (float) $values[0];
        $x = ($p / 100) * ($n - 1);
        $i = (int) floor($x);
        $f = $x - $i;
        return $i + 1 < $n ? $values[$i] + ($values[$i + 1] - $values[$i]) * $f : (float) $values[$i];
    }

    /**
     * Percentile of values that may be lower bounds: the result is a lower bound when any
     * value used in the interpolation is one. $bounds[i] belongs to $values[i].
     * @return array{0:float,1:bool}
     */
    public static function percentileBound(array $values, array $bounds, float $p): array
    {
        $pairs = array_map(null, array_values($values), array_values($bounds));
        usort($pairs, static fn($a, $b) => $a[0] <=> $b[0] ?: (int) $a[1] <=> (int) $b[1]);
        $n = count($pairs);
        if ($n === 1) return [(float) $pairs[0][0], (bool) $pairs[0][1]];
        $x = ($p / 100) * ($n - 1);
        $i = (int) floor($x);
        $f = $x - $i;
        if ($i + 1 >= $n || $f == 0.0) {
            return [(float) $pairs[$i][0], (bool) $pairs[$i][1]];
        }
        return [$pairs[$i][0] + ($pairs[$i + 1][0] - $pairs[$i][0]) * $f, $pairs[$i][1] || $pairs[$i + 1][1]];
    }

    /** Keeps rows inside [start, end], plus one bracketing sample on each side. */
    public static function slice(array $rows, int $start, int $end): array
    {
        $out = [];
        $n = count($rows);
        for ($i = 0; $i < $n; $i++) {
            $t = $rows[$i][0];
            $nextInside = ($i + 1 < $n) && $rows[$i + 1][0] > $start;
            $prevInside = ($i > 0) && $rows[$i - 1][0] < $end;
            if (($t >= $start && $t <= $end) || ($t < $start && $nextInside) || ($t > $end && $prevInside)) {
                $out[] = $rows[$i];
            }
        }
        return self::clip($out, $start, $end);
    }

    /** Interpolates the first/last rows onto the exact period bounds. */
    private static function clip(array $rows, int $start, int $end): array
    {
        $n = count($rows);
        if ($n < 2) return $rows;
        if ($rows[0][0] < $start) {
            $rows[0] = self::lerpRow($rows[0], $rows[1], $start);
        }
        if ($rows[$n - 1][0] > $end) {
            $rows[$n - 1] = self::lerpRow($rows[$n - 2], $rows[$n - 1], $end);
        }
        return $rows;
    }

    private static function lerpRow(array $a, array $b, int $t): array
    {
        $f = ($t - $a[0]) / max(1, $b[0] - $a[0]);
        $daz = $b[1] - $a[1];
        if ($daz > 180) $daz -= 360;
        if ($daz < -180) $daz += 360;
        $az = fmod($a[1] + $daz * $f + 360.0, 360.0);
        return [$t, $az, $a[2] + ($b[2] - $a[2]) * $f];
    }
}
