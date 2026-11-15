<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Sites;

use InvalidArgumentException;

/** Curated landing sites (data/sites.json) plus validated custom coordinates. */
final class SiteCatalog
{
    private array $data;

    public function __construct(string $file)
    {
        $this->data = json_decode((string) file_get_contents($file), true) ?: ['sites' => []];
    }

    public function all(): array
    {
        return $this->data['sites'];
    }

    public function defaultPair(): array
    {
        return $this->data['default_pair'] ?? [];
    }

    public function find(string $id): ?array
    {
        foreach ($this->data['sites'] as $s) {
            if ($s['id'] === $id) return $s;
        }
        return null;
    }

    /**
     * Resolves a site from request input: either {site: id} or {lat, lon[, alt_km]}.
     * Custom coordinates get id "custom" and never have terrain products.
     */
    public function resolve(array $in): array
    {
        if (!empty($in['site']) && $in['site'] !== 'custom') {
            $s = $this->find((string) $in['site']);
            if ($s === null) {
                throw new InvalidArgumentException('Unknown site: ' . $in['site']);
            }
            return $s;
        }
        if (!isset($in['lat'], $in['lon']) || !is_numeric($in['lat']) || !is_numeric($in['lon'])) {
            throw new InvalidArgumentException('Give a catalogue site id or numeric lat and lon.');
        }
        $lat = (float) $in['lat'];
        $lon = (float) $in['lon'];
        $alt = isset($in['alt_km']) && is_numeric($in['alt_km']) ? (float) $in['alt_km'] : 0.0;
        if ($lat < -90 || $lat > 90 || $lon < -360 || $lon > 360 || $alt < -10 || $alt > 11) {
            throw new InvalidArgumentException('Coordinates out of range.');
        }
        return [
            'id' => 'custom',
            'name' => sprintf('Custom %.4f°, %.4f°E', $lat, fmod($lon + 360, 360)),
            'lat' => $lat,
            'lon' => $lon,
            'alt_km' => $alt,
            'source' => 'User input',
            'status' => 'custom coordinate',
        ];
    }
}
