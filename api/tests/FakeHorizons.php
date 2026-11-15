<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Tests;

/**
 * Generates Horizons-formatted CSV output from simple analytic motions, so the whole
 * pipeline can be tested offline. Not physical: a test double only.
 *   Sun:   azimuth turns 360° per synodic month, elevation = 1° + 1.5°·sin(phase)
 *   Earth: azimuth = 7°·sin(libration), elevation = 6°·cos(libration), period 27.3 d
 */
final class FakeHorizons
{
    public int $calls = 0;

    public function __invoke(array $params): string
    {
        $this->calls++;
        $unq = static fn(string $v) => trim($v, "'");
        $start = strtotime($unq($params['START_TIME']) . ' UTC');
        $stop = strtotime($unq($params['STOP_TIME']) . ' UTC');
        $step = (int) $unq($params['STEP_SIZE']) * 60;
        $body = $unq($params['COMMAND']);
        $lines = [
            ' Date__(UT)__HR:MN, , , Azi_(a-app), Elev_(a-app),',
            '*******************************************************',
            '$$SOE',
        ];
        $center = $unq($params['CENTER'] ?? '');
        for ($t = $start; $t <= $stop; $t += $step) {
            [$az, $el] = self::position($body, $t, $center);
            $lines[] = sprintf(' %s, , , %.6f, %.6f,', gmdate('Y-M-d H:i', $t), $az, $el);
        }
        $lines[] = '$$EOE';
        return "header\n" . implode("\n", $lines) . "\nfooter\n";
    }

    /**
     * Moon from a DSN station: rises and sets once per 1.035 d; the three complexes are a
     * third of a day apart, and each sees the Moon above 10° for about 30 % of the time,
     * so the union leaves short daily gaps (as the real network can at higher masks).
     */
    public const STATION_PHASE = ['DSS-14@399' => 0.0, 'DSS-43@399' => 1 / 3, 'DSS-63@399' => 2 / 3];

    public static function position(string $body, int $t, string $center = ''): array
    {
        $epoch = strtotime('2030-01-01 00:00 UTC');
        $d = ($t - $epoch) / 86400;
        if ($body === '301') {
            $ph = 2 * M_PI * ($d / 1.035 + (self::STATION_PHASE[$center] ?? 0.0));
            return [fmod(360 * $d / 1.035 + 360, 360.0), 40 * sin($ph) - 15];
        }
        if ($body === '10') {
            $ph = 2 * M_PI * $d / 29.53;
            $az = fmod(360 * $d / 29.53, 360.0);
            return [$az < 0 ? $az + 360 : $az, 1.0 + 1.5 * sin($ph)];
        }
        $ph = 2 * M_PI * $d / 27.3;
        $az = 7 * sin($ph);
        return [$az < 0 ? $az + 360 : $az, 6 * cos($ph)];
    }
}
