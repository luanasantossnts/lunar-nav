<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Cache;

/** JSON files on disk, two-level sharded. Ephemerides do not change, so entries never expire. */
final class FileCache implements Cache
{
    public function __construct(private string $dir)
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0775, true);
        }
    }

    private function path(string $key): string
    {
        $h = sha1($key);
        return $this->dir . '/' . substr($h, 0, 2) . '/' . $h . '.json';
    }

    public function get(string $key): ?array
    {
        $p = $this->path($key);
        if (!is_file($p)) {
            return null;
        }
        $data = json_decode((string) file_get_contents($p), true);
        return is_array($data) ? $data : null;
    }

    public function delete(string $key): void
    {
        $p = $this->path($key);
        if (is_file($p)) {
            @unlink($p);
        }
    }

    /** The folder holding the cache files (for the privacy clean-up script). */
    public function dir(): string
    {
        return $this->dir;
    }

    public function set(string $key, array $value): void
    {
        $p = $this->path($key);
        if (!is_dir(dirname($p))) {
            @mkdir(dirname($p), 0775, true);
        }
        $tmp = $p . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, json_encode($value, JSON_UNESCAPED_SLASHES)) !== false) {
            @rename($tmp, $p);
        }
    }
}
