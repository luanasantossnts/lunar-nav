<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

// Shared hosting: never print PHP notices into the JSON (they go to the error log instead), and
// give the slow calls room (an Analyst question can make several Claude and Horizons requests).
// Both are silently ignored where the host does not allow them; see deploy/DEPLOY.md.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
if (function_exists('set_time_limit')) {
    @set_time_limit(150);
}

require __DIR__ . '/src/bootstrap.php';

(new LunarNav\App(lunarnav_config()))->serve();
