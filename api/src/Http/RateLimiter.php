<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Http;

use LunarNav\Cache\Cache;

/** Fixed-window per-client limit for paid endpoints (AI, voice). */
final class RateLimiter
{
    public function __construct(private Cache $cache)
    {
    }

    /** Counts one use; false when the client already used the hour's allowance. Only a hash of the client id is stored. */
    public function allow(string $bucket, string $client, int $perHour): bool
    {
        $window = (int) floor(time() / 3600);
        $key = "rate:{$bucket}:" . sha1($client) . ":{$window}";
        $n = (int) (($this->cache->get($key)['n'] ?? 0));
        if ($n >= $perHour) {
            return false;
        }
        $this->cache->set($key, ['n' => $n + 1]);
        return true;
    }
}
