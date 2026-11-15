<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Cache;

final class CacheFactory
{
    public static function make(array $config): Cache
    {
        $c = $config['cache'] ?? [];
        if (($c['driver'] ?? 'file') === 'mysql') {
            $m = $c['mysql'];
            return new MysqlCache($m['dsn'], $m['user'], $m['pass']);
        }
        return new FileCache($c['path'] ?? (LUNARNAV_ROOT . '/data/cache'));
    }
}
