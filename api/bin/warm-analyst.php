<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/*
 * Pre-generates the Analyst answers to the 3 suggested questions, in 3 languages and both
 * modes (Technical / Learn), for the default scenario, plus the MP3 of each spoken summary.
 * Answers already in the cache are skipped. Real API calls cost money, so by default this
 * only PRINTS THE PLAN; add --yes to run it.
 *
 *   php api/bin/warm-analyst.php                    plan only (no API calls)
 *   php api/bin/warm-analyst.php --yes              run it
 *   php api/bin/warm-analyst.php --mode=geometric   warm the geometric-horizon scenario instead
 *   php api/bin/warm-analyst.php --no-tts           answers only, no audio
 *
 * Keys come from the environment (docker run --env-file ~/lunar-dem/secrets.env) or config.php.
 * Run it where the live demo's cache lives (or upload api/data/cache afterwards).
 */
declare(strict_types=1);
require __DIR__ . '/../src/bootstrap.php';

use LunarNav\Agent\Analyst;
use LunarNav\Agent\Tools;
use LunarNav\Voice\Voice;

$opts = getopt('', ['yes', 'no-tts', 'mode:']);
$run = isset($opts['yes']);
$withTts = !isset($opts['no-tts']);
$horizon = ($opts['mode'] ?? 'terrain') === 'geometric' ? 'geometric' : 'terrain';

$config = lunarnav_config();
$app = new LunarNav\App($config);
$usage = $app->usage();
$scenario = ['a' => 'shackleton_ridge', 'b' => 'im2_athena', 'start' => '2030-07-01', 'days' => 30, 'mode' => $horizon, 'delay' => 10, 'earth_margin' => 0, 'power' => []];
$questions = [];
$suggested = json_decode((string) file_get_contents(LUNARNAV_ROOT . '/data/suggested.json'), true)['questions'];
foreach (['en', 'es', 'pt'] as $lang) {
    foreach ($suggested[$lang] as $q) {
        foreach (['technical', 'learn'] as $mode) {
            $questions[] = ['lang' => $lang, 'mode' => $mode, 'q' => (string) $q];
        }
    }
}
$analyst = new Analyst($config, new Tools($app->sites, $app->scenarios), $app->cache, $usage);
$voice = new Voice($config);
$todo = [];
foreach ($questions as $x) {
    $x['key'] = $analyst->cacheKey($x['q'], $x['lang'], $x['mode'], $scenario, []);
    $x['hit'] = $analyst->cached($x['key']);
    $todo[] = $x;
}
$missing = array_values(array_filter($todo, static fn($x) => $x['hit'] === null));
$maxSteps = max(1, min(6, (int) ($config['ai']['max_steps'] ?? 6)));

echo "Scenario: Shackleton ridge × IM-2 Athena, {$horizon} horizon, 2030-07-01, 30 days, delay 10 d, default power inputs.\n";
echo "Questions: 3 suggested × 3 languages × 2 modes = " . count($todo) . "; already cached: " . (count($todo) - count($missing)) . "; to generate: " . count($missing) . ".\n";
printf("Real Claude API requests: at least %d, at most %d (each question needs 1 request per tool round + 1 for the answer, capped at %d); typically about %d.\n",
    count($missing) * 2, count($missing) * $maxSteps, $maxSteps, count($missing) * 3);
printf("Model: %s · max_tokens %d · today's Claude requests so far: %d of %d.\n", $config['ai']['model'], (int) $config['ai']['max_tokens'], (int) $usage->get('claude_requests'), (int) $config['ai']['daily_claude_requests']);
if ($withTts) {
    printf("ElevenLabs: %s. One MP3 per answer summary (≤ %d characters each): at most %d calls and %s characters; summaries already cached are skipped.\n",
        $voice->configured() ? 'configured' : 'NOT configured (no audio will be generated)', Voice::SUMMARY_MAX, count($todo), number_format(count($todo) * Voice::SUMMARY_MAX));
}
if (($config['ai']['api_key'] ?? '') === '') {
    echo "ANTHROPIC_API_KEY is not set: nothing can be generated.\n";
    exit(1);
}
if (!$run) {
    echo "\nPlan only. Nothing was sent. Run again with --yes to generate.\n";
    exit(0);
}

$t0 = microtime(true); $before = $usage->day();
foreach ($todo as $i => $x) {
    $label = sprintf('[%2d/%d] %s %-9s %s', $i + 1, count($todo), $x['lang'], $x['mode'], mb_substr($x['q'], 0, 50));
    $resp = $x['hit'];
    if ($resp === null) {
        try {
            $resp = $analyst->ask($x['q'], [], $x['lang'], $x['mode'], $scenario, $x['key']);
            echo "$label … answered ({$resp['steps']} requests)\n";
        } catch (Throwable $e) {
            echo "$label … FAILED: " . $e->getMessage() . "\n";
            continue;
        }
    } else {
        echo "$label … already cached\n";
    }
    if ($withTts && $voice->configured()) {
        try {
            $text = Voice::spoken($resp['answer'], 'summary');
            $r = $voice->speakCached($text, $x['lang'], fn(int $c) => $usage->ensure('tts_chars', $c, (int) $config['voice']['tts_chars_per_day'], 'tts_daily'));
            $usage->add($r['cached'] ? ['tts_cache_hits' => 1] : ['tts_requests' => 1, 'tts_chars' => $r['chars']]);
            echo "        audio summary: {$r['chars']} characters" . ($r['cached'] ? ' (already cached)' : '') . "\n";
        } catch (Throwable $e) {
            echo "        audio FAILED: " . $e->getMessage() . "\n";
        }
    }
}
$after = $usage->day();
$d = static fn($k) => (int) (($after[$k] ?? 0) - ($before[$k] ?? 0));
printf("\nDone in %.0f s: %d Claude requests, %d input + %d cache-read + %d cache-write tokens, %d output tokens; %d TTS characters.\n",
    microtime(true) - $t0, $d('claude_requests'), $d('claude_input_tokens'), $d('claude_cache_read_tokens'), $d('claude_cache_write_tokens'), $d('claude_output_tokens'), $d('tts_chars'));
