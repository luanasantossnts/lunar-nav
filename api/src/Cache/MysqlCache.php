<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Cache;

use PDO;

/** MySQL-backed cache. Table: see bin/create-cache-table.sql. */
final class MysqlCache implements Cache
{
    private PDO $pdo;

    public function __construct(string $dsn, string $user, string $pass)
    {
        $this->pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    public function get(string $key): ?array
    {
        $st = $this->pdo->prepare('SELECT v FROM lunarnav_cache WHERE k = ?');
        $st->execute([sha1($key)]);
        $v = $st->fetchColumn();
        if ($v === false) {
            return null;
        }
        $data = json_decode((string) $v, true);
        return is_array($data) ? $data : null;
    }

    public function set(string $key, array $value): void
    {
        $st = $this->pdo->prepare('REPLACE INTO lunarnav_cache (k, v, created_at) VALUES (?, ?, NOW())');
        $st->execute([sha1($key), json_encode($value, JSON_UNESCAPED_SLASHES)]);
    }
}
