<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Dsn;

use RuntimeException;

/**
 * NASA Deep Space Network stations used for "contact with Earth": one 70-m antenna
 * per complex (Goldstone, Canberra, Madrid), from data/dsn.json, which cites the
 * DSN Telecommunications Link Design Handbook 810-005, module 301.
 */
final class DsnNetwork
{
    private array $data;

    public function __construct(string $file)
    {
        $d = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        if (!is_array($d) || empty($d['stations'])) {
            throw new RuntimeException('DSN station file missing or invalid: ' . basename($file));
        }
        $this->data = $d;
    }

    /** @return list<array{id:string,complex:string,lat:float,lon_east:float,height_m:float,horizons_center:string}> */
    public function stations(): array
    {
        return $this->data['stations'];
    }

    public function defaultMinElevation(): float
    {
        return (float) ($this->data['min_elevation_deg'] ?? 10.0);
    }

    /** Ephemeris step for the station series, set by the convergence check. */
    public function stepMinutes(): int
    {
        return (int) ($this->data['step_minutes'] ?? 10);
    }

    /** Compact description for provenance blocks. */
    public function describe(float $minElevation): array
    {
        return [
            'network' => $this->data['network'] ?? 'NASA Deep Space Network',
            'stations' => array_map(static fn($s) => [
                'id' => $s['id'], 'complex' => $s['complex'], 'lat' => $s['lat'], 'lon_east' => $s['lon_east'],
                'height_m' => $s['height_m'], 'horizons_center' => $s['horizons_center'],
            ], $this->data['stations']),
            'coordinates_source' => $this->data['source'] ?? null,
            'coordinates_url' => $this->data['source_url'] ?? null,
            'min_elevation_deg' => $minElevation,
            'step_minutes' => $this->stepMinutes(),
            'target' => 'Moon centre (301), apparent, airless',
            'rule' => 'contact = Earth in view from the site (current horizon model and Earth margin) ∩ union of stations with the Moon above the minimum elevation',
        ];
    }
}
