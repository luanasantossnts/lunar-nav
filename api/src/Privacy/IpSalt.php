<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Privacy;

/**
 * The secret salt used to hash client IP addresses for the hourly limits. Taken from the
 * IP_SALT environment variable (via config privacy.ip_salt); otherwise read from, or created
 * in, a file outside the web root (config privacy.salt_file, default: the folder above the
 * site root). The salt never leaves the server and is never logged.
 */
final class IpSalt
{
    private static ?string $memo = null;

    public static function resolve(array $config): string
    {
        $env = (string) ($config['privacy']['ip_salt'] ?? '');
        if ($env !== '') {
            return $env;
        }
        if (self::$memo !== null) {
            return self::$memo;
        }
        $api = realpath(LUNARNAV_ROOT) ?: LUNARNAV_ROOT;           // …/public_html/api
        $site = dirname($api);                                     // …/public_html (web root)
        $candidates = array_filter([
            $config['privacy']['salt_file'] ?? null,
            dirname($site) . '/.lunarnav-ip-salt',                // above the web root on the usual hosting layout
            sys_get_temp_dir() . '/lunarnav-ip-salt',
        ]);
        foreach ($candidates as $f) {
            if (self::insideSite((string) $f, $site)) {
                continue; // never inside the site folder, where it could be served or committed
            }
            // @: with open_basedir, a path outside the allowed folders only fails (no warning in the JSON).
            if (@is_file($f) && @is_readable($f)) {
                $s = trim((string) file_get_contents($f));
                if (strlen($s) >= 32) {
                    return self::$memo = $s;
                }
            }
            $s = bin2hex(random_bytes(32));
            // The configured private folder (e.g. /home/USER/lunarnav-private) may not exist yet.
            if (!@is_dir(dirname((string) $f))) {
                @mkdir(dirname((string) $f), 0700, true);
            }
            if (@file_put_contents($f, $s . "\n", LOCK_EX) !== false) {
                @chmod($f, 0600);
                return self::$memo = $s;
            }
        }
        // Nowhere writable: a salt for this process only (limits reset more often; still no IP stored).
        return self::$memo = bin2hex(random_bytes(32));
    }

    /** True when $file would be inside the site folder (web root + project). */
    public static function insideSite(string $file, string $site): bool
    {
        $dir = @realpath(dirname($file)) ?: dirname($file);
        $site = rtrim(@realpath($site) ?: $site, '/');
        return $dir === $site || str_starts_with($dir . '/', $site . '/');
    }

    /** For tests. */
    public static function reset(): void
    {
        self::$memo = null;
    }
}
