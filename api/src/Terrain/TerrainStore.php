<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Terrain;

/**
 * Reads precomputed terrain products for catalogue sites:
 *   <terrain>/<site_id>/mask.json   horizon mask at the site
 *   <terrain>/<site_id>/grid.json   masks on a grid around the site (sensitivity map)
 *   <terrain>/<site_id>/heightmap.json + heightmap.bin   for the 3D view
 *   <terrain>/<site_id>/hillshade.png                    for the map
 */
final class TerrainStore
{
    public function __construct(private string $dir)
    {
    }

    private function siteDir(string $siteId): ?string
    {
        if (!preg_match('/^[a-z0-9_]{1,64}$/', $siteId)) {
            return null;
        }
        $d = $this->dir . '/' . $siteId;
        return is_dir($d) ? $d : null;
    }

    public function mask(string $siteId): ?HorizonMask
    {
        $d = $this->siteDir($siteId);
        if ($d === null || !is_file($d . '/mask.json')) {
            return null;
        }
        return HorizonMask::fromArray(self::readJson($d . '/mask.json'));
    }

    public function grid(string $siteId): ?array
    {
        $d = $this->siteDir($siteId);
        if ($d === null || !is_file($d . '/grid.json')) {
            return null;
        }
        return self::readJson($d . '/grid.json');
    }

    /**
     * A terrain file that exists but cannot be read (e.g. while it is being rewritten) is an
     * error, never "no terrain": the caller must not fall back silently.
     */
    private static function readJson(string $file): array
    {
        $raw = @file_get_contents($file);
        $a = $raw === false ? null : json_decode($raw, true);
        if (!is_array($a)) {
            throw new \RuntimeException('Terrain data for this site could not be read. Please try again.');
        }
        return $a;
    }

    /** Identifies the current grid file (changes when it is rebuilt); null without a grid. */
    public function gridVersion(string $siteId): ?string
    {
        $d = $this->siteDir($siteId);
        $f = $d === null ? null : $d . '/grid.json';
        if ($f === null || !is_file($f)) {
            return null;
        }
        clearstatcache(true, $f);
        return sha1(filesize($f) . ':' . filemtime($f));
    }

    /** @return array{mask:bool,grid:bool,heightmap:bool,hillshade:bool} */
    public function availability(string $siteId): array
    {
        $d = $this->siteDir($siteId);
        return [
            'mask' => $d !== null && is_file($d . '/mask.json'),
            'grid' => $d !== null && is_file($d . '/grid.json'),
            'heightmap' => $d !== null && is_file($d . '/heightmap.json'),
            'hillshade' => $d !== null && is_file($d . '/hillshade.png'),
        ];
    }
}
