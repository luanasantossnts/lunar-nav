<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Terrain;

/**
 * Terrain horizon: elevation angle of the skyline (degrees) as a function of azimuth.
 * Produced offline by preprocess/build_site_assets.py from a NASA LOLA DEM.
 */
final class HorizonMask
{
    /** @param list<float> $elevations one value per azimuth bin starting at 0° */
    public function __construct(
        public readonly float $azStep,
        public readonly array $elevations,
        public readonly array $meta = []
    ) {
    }

    public static function fromArray(array $a): self
    {
        return new self((float) $a['az_step_deg'], array_map('floatval', $a['elevations']), $a['meta'] ?? []);
    }

    /** Skyline elevation at an azimuth, linear interpolation with wrap-around. */
    public function at(float $azDeg): float
    {
        $n = count($this->elevations);
        $x = fmod(fmod($azDeg, 360.0) + 360.0, 360.0) / $this->azStep;
        $i = (int) floor($x);
        $f = $x - $i;
        $a = $this->elevations[$i % $n];
        $b = $this->elevations[($i + 1) % $n];
        return $a + ($b - $a) * $f;
    }

    public function toArray(): array
    {
        return ['az_step_deg' => $this->azStep, 'elevations' => $this->elevations, 'meta' => $this->meta];
    }
}
