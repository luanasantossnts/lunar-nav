<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Usage;

use LunarNav\Cache\Cache;
use LunarNav\Http\ApiError;

/**
 * Daily usage counters for the paid services (Claude, ElevenLabs), kept in the app cache
 * under "usage:v1:YYYY-MM-DD" (UTC). They also enforce the global daily limits. Nothing
 * personal is stored (no IP addresses), and none of this is exposed by the public API;
 * bin/usage.php prints it.
 *
 * Fields: claude_requests, claude_questions, claude_input_tokens, claude_output_tokens,
 * claude_cache_write_tokens, claude_cache_read_tokens, analyst_cache_hits, tts_requests,
 * tts_chars, tts_cache_hits, stt_requests, stt_seconds, limit_hits.
 */
final class Usage
{
    /** @var callable():int */
    private $clock;

    public function __construct(private Cache $cache, ?callable $clock = null)
    {
        $this->clock = $clock ?? static fn(): int => time();
    }

    public static function key(string $day): string
    {
        return 'usage:v1:' . $day;
    }

    public function todayKey(): string
    {
        return gmdate('Y-m-d', ($this->clock)());
    }

    /** @return array<string,int|float> */
    public function day(?string $day = null): array
    {
        return $this->cache->get(self::key($day ?? $this->todayKey())) ?? [];
    }

    public function get(string $field): float
    {
        return (float) ($this->day()[$field] ?? 0);
    }

    /** @param array<string,int|float> $deltas */
    public function add(array $deltas): void
    {
        $k = self::key($this->todayKey());
        $d = $this->cache->get($k) ?? [];
        foreach ($deltas as $f => $v) {
            $d[$f] = ($d[$f] ?? 0) + $v;
        }
        $this->cache->set($k, $d);
    }

    /** Throws when adding $amount to today's $field would exceed $limit. */
    public function ensure(string $field, float $amount, float $limit, string $code): void
    {
        if ($this->get($field) + $amount > $limit) {
            $this->add(['limit_hits' => 1]);
            throw new ApiError($code, 'The daily limit for this feature has been reached. Please try again tomorrow.', 429);
        }
    }
}
