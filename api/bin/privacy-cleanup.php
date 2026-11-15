<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/*
 * Privacy housekeeping for the app cache (safe to run from cron, e.g. hourly):
 *   - deletes hourly-limit records older than 48 h, and any record in the old unsalted format;
 *   - with --scan, reports any IP-address-looking text found in the cache (it should be none).
 *
 *   php api/bin/privacy-cleanup.php            clean
 *   php api/bin/privacy-cleanup.php --scan     clean, then scan for IP addresses
 *   php api/bin/privacy-cleanup.php --dry-run  only report
 */
declare(strict_types=1);
require __DIR__ . '/../src/bootstrap.php';

$opts = getopt('', ['scan', 'dry-run']);
$dry = isset($opts['dry-run']);
$config = lunarnav_config();
$cache = LunarNav\Cache\CacheFactory::make($config);
$now = time();

$limiter = new LunarNav\Http\RateLimiter($cache, LunarNav\Privacy\IpSalt::resolve($config));
$indexed = $dry ? 0 : $limiter->purge($now, true);
printf("Hourly-limit records older than 48 h removed via the index: %d\n", $indexed);

if (!$cache instanceof LunarNav\Cache\FileCache) {
    echo "Cache driver is not 'file': the index sweep above is all that is needed.\n";
    exit(0);
}
$r = LunarNav\Privacy\Cleanup::sweep($cache->dir(), $now, $dry);
printf("Old-format limit records %s: %d\nLimit records older than 48 h %s: %d\nCurrent limit records kept: %d\n",
    $dry ? 'found' : 'removed', $r['legacy'], $dry ? 'found' : 'removed', $r['expired'], $r['kept']);
if (isset($opts['scan'])) {
    $hits = LunarNav\Privacy\Cleanup::scanForIps($cache->dir());
    printf("Files with IP-address-looking text: %d%s\n", count($hits), $hits ? ' — ' . implode(', ', array_slice($hits, 0, 10)) : '');
}
