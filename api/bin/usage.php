<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
// Usage of the paid services per UTC day (from the app cache). Private: not exposed by the API.
//   php api/bin/usage.php           last 7 days
//   php api/bin/usage.php 30        last 30 days
declare(strict_types=1);
require __DIR__ . '/../src/bootstrap.php';

$days = max(1, min(366, (int) ($argv[1] ?? 7)));
$config = lunarnav_config();
$usage = new LunarNav\Usage\Usage(LunarNav\Cache\CacheFactory::make($config));
$cols = [
    'claude_questions' => 'questions', 'claude_requests' => 'Claude req', 'analyst_cache_hits' => 'cached ans',
    'claude_input_tokens' => 'in tok', 'claude_cache_read_tokens' => 'cache read', 'claude_cache_write_tokens' => 'cache write', 'claude_output_tokens' => 'out tok',
    'tts_requests' => 'TTS req', 'tts_chars' => 'TTS chars', 'tts_cache_hits' => 'TTS cached', 'stt_requests' => 'STT req', 'stt_seconds' => 'STT s', 'limit_hits' => 'limits hit',
];
printf("%-10s %s\n", 'day (UTC)', implode(' ', array_map(static fn($h) => str_pad($h, 11, ' ', STR_PAD_LEFT), $cols)));
$tot = [];
for ($i = $days - 1; $i >= 0; $i--) {
    $d = gmdate('Y-m-d', time() - $i * 86400);
    $row = $usage->day($d);
    foreach ($cols as $k => $_) $tot[$k] = ($tot[$k] ?? 0) + ($row[$k] ?? 0);
    if (!$row) continue;
    printf("%-10s %s\n", $d, implode(' ', array_map(static fn($k) => str_pad((string) round((float) ($row[$k] ?? 0)), 11, ' ', STR_PAD_LEFT), array_keys($cols))));
}
printf("%-10s %s\n", 'total', implode(' ', array_map(static fn($k) => str_pad((string) round((float) $tot[$k]), 11, ' ', STR_PAD_LEFT), array_keys($cols))));
$q = $tot['claude_questions'] + $tot['analyst_cache_hits'];
if ($q > 0) printf("\nAnswers served from the cache: %.0f %% of %d questions.\n", 100 * $tot['analyst_cache_hits'] / $q, $q);
$in = $tot['claude_input_tokens'] + $tot['claude_cache_read_tokens'] + $tot['claude_cache_write_tokens'];
if ($in > 0) printf("Claude input served from the prompt cache: %.0f %%.\n", 100 * $tot['claude_cache_read_tokens'] / $in);
