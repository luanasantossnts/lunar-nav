<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Privacy;

use FilesystemIterator;
use LunarNav\Http\RateLimiter;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/** File-cache sweeps for privacy: expired / old-format limit records, and a scan for IP addresses. */
final class Cleanup
{
    public const IPV4 = '/(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/';
    public const IPV6 = '/(?<![0-9a-f:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![0-9a-f:])|(?<![0-9a-f:])(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}(?![0-9a-f:])/i';

    /** @return array{legacy:int, expired:int, kept:int} */
    public static function sweep(string $dir, int $now, bool $dryRun = false): array
    {
        $r = ['legacy' => 0, 'expired' => 0, 'kept' => 0];
        foreach (self::files($dir) as $path) {
            $d = json_decode((string) file_get_contents($path), true);
            if (!is_array($d)) continue;
            $keys = array_keys($d);
            if ($keys === ['n']) {                         // old format: unsalted hash in the key
                $r['legacy']++;
                if (!$dryRun) @unlink($path);
            } elseif ($keys === ['n', 'w']) {
                if (((int) $d['w'] + 1) * 3600 < $now - RateLimiter::KEEP_SECONDS) {
                    $r['expired']++;
                    if (!$dryRun) @unlink($path);
                } else {
                    $r['kept']++;
                }
            }
        }
        return $r;
    }

    /** Relative paths of cache files containing IPv4/IPv6-looking text. */
    public static function scanForIps(string $dir): array
    {
        $hits = [];
        foreach (self::files($dir) as $path) {
            $raw = (string) file_get_contents($path);
            if (preg_match(self::IPV4, $raw) || preg_match(self::IPV6, $raw)) {
                $hits[] = substr($path, strlen($dir) + 1);
            }
        }
        return $hits;
    }

    /** @return list<string> */
    private static function files(string $dir): array
    {
        if (!is_dir($dir)) return [];
        $out = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $f) {
            if ($f->getExtension() === 'json') $out[] = $f->getPathname();
        }
        return $out;
    }
}
