<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Cache;

interface Cache
{
    public function get(string $key): ?array;

    public function set(string $key, array $value): void;
}
