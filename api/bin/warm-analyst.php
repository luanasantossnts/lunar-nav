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
 *   php api/bin/warm-analyst.php --audio-only       audio for answers already cached; never calls Claude
 *
 * Keys come from the environment (docker run --env-file ~/lunar-dem/secrets.env) or config.php.
 * Run it where the live demo's cache lives (or upload api/data/cache afterwards).
 */
declare(strict_types=1);
require __DIR__ . '/../src/bootstrap.php';

use LunarNav\Agent\Analyst;
use LunarNav\Agent\Tools;
use LunarNav\Voice\Voice;

$opts = getopt('', ['yes', 'no-tts', 'mode:', 'audio-only']);
$run = isset($opts['yes']);
$audioOnly = isset($opts['audio-only']);
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
    $x['hit'] = $analyst->cached($x['key'], false); // looking only: not counted as a cache hit
    // Audio state of a cached answer: is the MP3 of its spoken summary already on disk?
    $x['audio'] = null;
    if ($x['hit'] !== null) {
        $text = Voice::spoken($x['hit']['answer'], 'summary');
        $x['chars'] = mb_strlen($text);
        $x['audio'] = $voice->configured() ? is_file($voice->ttsPath($voice->ttsHash($text, $x['lang']))) : null;
    }
    $todo[] = $x;
}
$missing = array_values(array_filter($todo, static fn($x) => $x['hit'] === null));
$askClaude = $audioOnly ? [] : $missing;
$maxSteps = max(1, min(6, (int) ($config['ai']['max_steps'] ?? 6)));
$audioMissing = array_values(array_filter($todo, static fn($x) => $x['audio'] === false));

echo "Scenario: Shackleton ridge × IM-2 Athena, {$horizon} horizon, 2030-07-01, 30 days, delay 10 d, default power inputs.\n\n";
printf("%-4s %-3s %-9s %-8s %-10s %s\n", '#', 'lng', 'mode', 'answer', 'audio', 'question');
foreach ($todo as $i => $x) {
    $audio = $x['hit'] === null ? '—' : ($x['audio'] === null ? 'n/a' : ($x['audio'] ? 'cached' : 'to make'));
    printf("%-4d %-3s %-9s %-8s %-10s %s\n", $i + 1, $x['lang'], $x['mode'], $x['hit'] !== null ? 'cached' : ($audioOnly ? 'skip' : 'ASK'), $audio, mb_substr($x['q'], 0, 60));
}
echo "\nAnswers: " . (count($todo) - count($missing)) . " of " . count($todo) . " cached.\n";
if ($askClaude) {
    printf("Claude: %d question(s) to ask → at least %d, at most %d real API requests (typically about %d).\n", count($askClaude), count($askClaude) * 2, count($askClaude) * $maxSteps, count($askClaude) * 3);
} else {
    echo "Claude: NO calls" . ($missing && $audioOnly ? ' (--audio-only: ' . count($missing) . ' uncached question(s) skipped)' : '') . ".\n";
}
printf("Model: %s · today's Claude requests so far: %d of %d.\n", $config['ai']['model'], (int) $usage->get('claude_requests'), (int) $config['ai']['daily_claude_requests']);
if ($withTts) {
    if (!$voice->configured()) {
        echo "ElevenLabs: NOT configured (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID): no audio will be generated.\n";
    } else {
        $chars = array_sum(array_map(static fn($x) => $x['chars'], $audioMissing));
        printf("ElevenLabs: %d audio file(s) to make for cached answers (%s characters), plus one per newly answered question; 2 s pause between files; 429/5xx retried after 2, 5 and 10 s.\n", count($audioMissing), number_format($chars));
    }
}
if (($config['ai']['api_key'] ?? '') === '' && $askClaude) {
    echo "ANTHROPIC_API_KEY is not set: questions cannot be answered (use --audio-only for audio only).\n";
    exit(1);
}
if (!$run) {
    echo "\nPlan only. Nothing was sent. Run again with --yes" . ($missing && !$audioOnly ? ' (or --yes --audio-only to skip Claude)' : '') . " to generate.\n";
    exit(0);
}

$t0 = microtime(true); $before = $usage->day(); $made = 0;
foreach ($todo as $i => $x) {
    $label = sprintf('[%2d/%d] %s %-9s %s', $i + 1, count($todo), $x['lang'], $x['mode'], mb_substr($x['q'], 0, 50));
    $resp = $x['hit'];
    if ($resp === null) {
        if ($audioOnly) {
            echo "$label … skipped (not cached, --audio-only)\n";
            continue;
        }
        try {
            $resp = $analyst->ask($x['q'], [], $x['lang'], $x['mode'], $scenario, $x['key']);
            echo "$label … answered ({$resp['steps']} requests)\n";
        } catch (Throwable $e) {
            echo "$label … FAILED: " . $e->getMessage() . "\n";
            continue;
        }
    } else {
        echo "$label … answer cached\n";
    }
    if ($withTts && $voice->configured()) {
        $text = Voice::spoken($resp['answer'], 'summary');
        if (!is_file($voice->ttsPath($voice->ttsHash($text, $x['lang'])))) {
            if ($made > 0) {
                sleep(2); // spacing between real ElevenLabs calls
            }
            $made++;
        }
        try {
            $r = $voice->speakCached($text, $x['lang'], fn(int $c) => $usage->ensure('tts_chars', $c, (int) $config['voice']['tts_chars_per_day'], 'tts_daily'));
            // Only successful syntheses count as usage; failed attempts are not recorded.
            $usage->add($r['cached'] ? ['tts_cache_hits' => 1] : ['tts_requests' => 1, 'tts_chars' => $r['chars']]);
            echo "        audio summary: {$r['chars']} characters" . ($r['cached'] ? ' (already cached)' : ' (generated)') . "\n";
        } catch (Throwable $e) {
            // e.g. "ElevenLabs HTTP 429: too_many_concurrent_requests (after 3 retries)"; never includes the key.
            echo "        audio FAILED: " . $e->getMessage() . "\n";
        }
    }
}
$after = $usage->day();
$d = static fn($k) => (int) (($after[$k] ?? 0) - ($before[$k] ?? 0));
printf("\nDone in %.0f s: %d Claude requests, %d input + %d cache-read + %d cache-write tokens, %d output tokens; %d TTS files, %d TTS characters.\n",
    microtime(true) - $t0, $d('claude_requests'), $d('claude_input_tokens'), $d('claude_cache_read_tokens'), $d('claude_cache_write_tokens'), $d('claude_output_tokens'), $d('tts_requests'), $d('tts_chars'));
