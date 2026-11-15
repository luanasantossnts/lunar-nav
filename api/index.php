<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

(new LunarNav\App(lunarnav_config()))->serve();
