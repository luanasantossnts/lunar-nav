<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Local development server.
 *
 *   php -S localhost:8080 -t frontend/dist api/dev-router.php
 *
 * /api/* goes to the API; anything else is served from the built front-end.
 * Set LUNARNAV_FAKE_HORIZONS=1 to run fully offline with the analytic test double
 * (results are then labelled "FAKE (offline test double)" everywhere). Never use it
 * for real results.
 */
declare(strict_types=1);

$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!str_starts_with($path, '/api/')) {
    return false; // let the built-in server serve the static file
}

require __DIR__ . '/src/bootstrap.php';
$config = lunarnav_config();
if (getenv('LUNARNAV_TERRAIN_DIR')) {
    $config['terrain']['path'] = getenv('LUNARNAV_TERRAIN_DIR');
}
$horizons = null;
if (getenv('LUNARNAV_FAKE_HORIZONS') === '1') {
    require __DIR__ . '/tests/FakeHorizons.php';
    $cache = LunarNav\Cache\CacheFactory::make(['cache' => ['driver' => 'file', 'path' => sys_get_temp_dir() . '/lunarnav-fake-cache']]);
    $horizons = new LunarNav\Horizons\HorizonsClient($cache, 'unused', 5, new LunarNav\Tests\FakeHorizons());
    $horizons->label = 'FAKE (offline test double)';
}
(new LunarNav\App($config, $horizons))->serve();
