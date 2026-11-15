<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Http;

use LunarNav\Cache\Cache;

/**
 * Fixed-window, per-client hourly limit for the paid features (AI, voice).
 *
 * Privacy: the client address is never stored. Only an HMAC-SHA256 of it with a secret salt
 * (IP_SALT) goes into the record key, so the address cannot be recovered by trying all
 * addresses. Records are deleted automatically after 48 hours (an index of the hourly windows
 * is kept for this; bin/privacy-cleanup.php does the same sweep for the file cache).
 */
final class RateLimiter
{
    public const KEEP_SECONDS = 48 * 3600;
    private const INDEX = 'rate:v2:index';

    /** @var callable():int */
    private $clock;

    public function __construct(private Cache $cache, private string $salt, ?callable $clock = null)
    {
        $this->clock = $clock ?? static fn(): int => time();
    }

    public static function clientHash(string $client, string $salt): string
    {
        return hash_hmac('sha256', $client, $salt);
    }

    /** Counts one use; false when the client already used the hour's allowance. */
    public function allow(string $bucket, string $client, int $perHour): bool
    {
        $now = ($this->clock)();
        $window = intdiv($now, 3600);
        $key = "rate:v2:{$bucket}:" . self::clientHash($client, $this->salt) . ":{$window}";
        $n = (int) ($this->cache->get($key)['n'] ?? 0);
        $this->purge($now);
        if ($n >= $perHour) {
            return false;
        }
        $this->cache->set($key, ['n' => $n + 1, 'w' => $window]);
        if ($n === 0) {
            $this->remember($key, $window);
        }
        return true;
    }

    private function remember(string $key, int $window): void
    {
        $idx = $this->cache->get(self::INDEX) ?? ['windows' => [], 'cleaned' => 0];
        $idx['windows'][(string) $window][] = $key;
        $this->cache->set(self::INDEX, $idx);
    }

    /** Deletes every record whose hour ended more than 48 h ago (checked at most once an hour). */
    public function purge(int $now, bool $force = false): int
    {
        $idx = $this->cache->get(self::INDEX);
        if (!$idx || (!$force && ($now - (int) ($idx['cleaned'] ?? 0)) < 3600)) {
            return 0;
        }
        $deleted = 0;
        foreach ($idx['windows'] as $w => $keys) {
            if (((int) $w + 1) * 3600 < $now - self::KEEP_SECONDS) {
                foreach ($keys as $k) {
                    $this->cache->delete($k);
                    $deleted++;
                }
                unset($idx['windows'][$w]);
            }
        }
        $idx['cleaned'] = $now;
        $this->cache->set(self::INDEX, $idx);
        return $deleted;
    }
}
