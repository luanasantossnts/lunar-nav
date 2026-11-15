<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Geo;

/**
 * Local East-North-Up frames on a spherical Moon (body-fixed, east-positive longitude).
 *
 * Used to move a direction measured at one site (the Sun, effectively at infinity,
 * or Earth, ~384,000 km away) to a nearby site a few km away. The direction is the
 * same in the body-fixed frame; only the local horizon plane tilts. Parallax for
 * Earth across a 10 km offset is below 0.002°, negligible next to terrain effects.
 */
final class Frames
{
    public const MOON_RADIUS_KM = 1737.4;

    /** @return array{0:array,1:array,2:array} E, N, U unit vectors */
    public static function enu(float $latDeg, float $lonDeg): array
    {
        $p = deg2rad($latDeg);
        $l = deg2rad($lonDeg);
        $e = [-sin($l), cos($l), 0.0];
        $n = [-sin($p) * cos($l), -sin($p) * sin($l), cos($p)];
        $u = [cos($p) * cos($l), cos($p) * sin($l), sin($p)];
        return [$e, $n, $u];
    }

    /** Azimuth (clockwise from north) and elevation to a body-fixed unit vector. */
    public static function azElToVector(float $azDeg, float $elDeg, float $latDeg, float $lonDeg): array
    {
        [$e, $n, $u] = self::enu($latDeg, $lonDeg);
        $a = deg2rad($azDeg);
        $h = deg2rad($elDeg);
        $ce = cos($h);
        $v = [];
        for ($i = 0; $i < 3; $i++) {
            $v[$i] = $ce * (sin($a) * $e[$i] + cos($a) * $n[$i]) + sin($h) * $u[$i];
        }
        return $v;
    }

    /** @return array{0:float,1:float} azimuth 0–360, elevation */
    public static function vectorToAzEl(array $v, float $latDeg, float $lonDeg): array
    {
        [$e, $n, $u] = self::enu($latDeg, $lonDeg);
        $x = $v[0] * $e[0] + $v[1] * $e[1] + $v[2] * $e[2];
        $y = $v[0] * $n[0] + $v[1] * $n[1] + $v[2] * $n[2];
        $z = $v[0] * $u[0] + $v[1] * $u[1] + $v[2] * $u[2];
        $az = rad2deg(atan2($x, $y));
        if ($az < 0) $az += 360.0;
        $el = rad2deg(atan2($z, sqrt($x * $x + $y * $y)));
        return [$az, $el];
    }

    /** Moves an az/el series from site A to site B (direction preserved in body frame). */
    public static function transferSeries(array $rows, array $from, array $to): array
    {
        $out = [];
        foreach ($rows as $r) {
            $v = self::azElToVector($r[1], $r[2], $from['lat'], $from['lon']);
            [$az, $el] = self::vectorToAzEl($v, $to['lat'], $to['lon']);
            $out[] = [$r[0], $az, $el];
        }
        return $out;
    }

    /** Destination point on the sphere from (lat, lon) along azimuth for a distance in km. */
    public static function destination(float $latDeg, float $lonDeg, float $azDeg, float $distKm): array
    {
        $d = $distKm / self::MOON_RADIUS_KM;
        $p1 = deg2rad($latDeg);
        $l1 = deg2rad($lonDeg);
        $a = deg2rad($azDeg);
        $p2 = asin(sin($p1) * cos($d) + cos($p1) * sin($d) * cos($a));
        $l2 = $l1 + atan2(sin($a) * sin($d) * cos($p1), cos($d) - sin($p1) * sin($p2));
        $lon = fmod(rad2deg($l2) + 360.0, 360.0);
        return [rad2deg($p2), $lon];
    }
}
