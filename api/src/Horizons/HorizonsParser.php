<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Horizons;

use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;

/**
 * Parses a JPL Horizons OBSERVER table (CSV_FORMAT=YES, QUANTITIES=4) into rows.
 * Columns are located by header name, so solar/interferer presence markers do not matter.
 */
final class HorizonsParser
{
    /** @return list<array{0:int,1:float,2:float}> rows of [unix_time, azimuth_deg, elevation_deg] */
    public static function parse(string $text): array
    {
        $lines = preg_split('/\r?\n/', $text) ?: [];
        $trimmed = array_map('trim', $lines);
        $soe = array_search('$$SOE', $trimmed, true);
        $eoe = array_search('$$EOE', $trimmed, true);
        if ($soe === false || $eoe === false || $eoe <= $soe) {
            throw new RuntimeException('Horizons response has no $$SOE/$$EOE block: ' . substr($text, 0, 400));
        }

        $header = null;
        for ($i = $soe - 1; $i >= 0; $i--) {
            if (stripos($lines[$i], 'Date') !== false && str_contains($lines[$i], ',')) {
                $header = array_map('trim', explode(',', $lines[$i]));
                break;
            }
        }
        if ($header === null) {
            throw new RuntimeException('Horizons CSV header not found.');
        }
        $iDate = $iAz = $iEl = null;
        foreach ($header as $idx => $col) {
            if ($iDate === null && stripos($col, 'Date') !== false) $iDate = $idx;
            if ($iAz === null && stripos($col, 'Azi') !== false) $iAz = $idx;
            if ($iEl === null && stripos($col, 'Elev') !== false) $iEl = $idx;
        }
        if ($iDate === null || $iAz === null || $iEl === null) {
            throw new RuntimeException('Horizons header lacks Date/Azi/Elev: ' . implode(' | ', $header));
        }

        $rows = [];
        for ($i = $soe + 1; $i < $eoe; $i++) {
            $cells = array_map('trim', explode(',', $lines[$i]));
            if (count($cells) <= max($iDate, $iAz, $iEl)) continue;
            if (!is_numeric($cells[$iAz]) || !is_numeric($cells[$iEl])) continue;
            $rows[] = [self::toTs($cells[$iDate]), (float) $cells[$iAz], (float) $cells[$iEl]];
        }
        if (!$rows) {
            throw new RuntimeException('Horizons table had no data rows.');
        }
        return $rows;
    }

    public static function toTs(string $t): int
    {
        $t = (string) preg_replace('/^[AB]\.?D\.?\s*/', '', trim($t));
        $tz = new DateTimeZone('UTC');
        foreach (['Y-M-d H:i', 'Y-M-d H:i:s', 'Y-M-d H:i:s.u', 'Y-m-d H:i'] as $fmt) {
            $d = DateTimeImmutable::createFromFormat($fmt, $t, $tz);
            if ($d !== false) {
                return $d->getTimestamp();
            }
        }
        throw new RuntimeException("Unexpected Horizons date format: '{$t}'");
    }
}
