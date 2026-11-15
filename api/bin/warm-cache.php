<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Pre-fetches the demo scenarios from JPL Horizons into the cache, so the public
 * demo answers instantly and keeps working if Horizons is slow.
 * Usage: php bin/warm-cache.php [start=2030-07-01] [days=30]
 */

require __DIR__ . '/../src/bootstrap.php';

$app = new LunarNav\App(lunarnav_config());
$start = $argv[1] ?? '2030-07-01';
$days = (int) ($argv[2] ?? 30);
$pair = $app->sites->defaultPair();
$targets = array_unique(array_merge($pair, ['apollo11', 'im1_odysseus', 'malapert_m1', 'chandrayaan3']));

foreach ($targets as $id) {
    foreach ([['start' => $start], ['start' => gmdate('Y-m-d', strtotime($start . ' UTC') + 10 * 86400)]] as $variant) {
        $t = microtime(true);
        try {
            $r = $app->handle('GET', '/metrics', ['site' => $id, 'start' => $variant['start'], 'days' => (string) $days], []);
            printf("%-18s %s  sun %5.1f%%  earth %5.1f%%  %s  %.1fs\n", $id, $variant['start'], 100 * $r['metrics']['sun']['fraction'], 100 * $r['metrics']['earth']['fraction'], $r['provenance']['cached'] ? 'cached' : 'fetched', microtime(true) - $t);
        } catch (Throwable $e) {
            printf("%-18s %s  ERROR %s\n", $id, $variant['start'], $e->getMessage());
        }
    }
}
// Window search range used by the demo (one long series).
try {
    $app->handle('GET', '/windows', ['site' => $pair[0], 'from' => $start, 'to' => gmdate('Y-m-d', strtotime($start . ' UTC') + 60 * 86400), 'duration_days' => '14'], []);
    echo "window-search series cached\n";
} catch (Throwable $e) {
    echo 'window search: ' . $e->getMessage() . "\n";
}
