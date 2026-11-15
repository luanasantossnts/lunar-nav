<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

/**
 * Lunar Nav API bootstrap: autoloader and configuration.
 */

spl_autoload_register(static function (string $class): void {
    $prefix = 'LunarNav\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/' . $relative . '.php';
    if (is_file($file)) {
        require $file;
    }
});

const LUNARNAV_METHOD_VERSION = '1.0.0';
const LUNARNAV_ROOT = __DIR__ . '/..';

/**
 * Loads config.php (falls back to config.example.php) and lets environment
 * variables override secrets, so keys never need to live in the repository.
 */
function lunarnav_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $file = LUNARNAV_ROOT . '/config.php';
    $ownConfig = is_file($file);
    if (!$ownConfig) {
        $file = LUNARNAV_ROOT . '/config.example.php';
    }
    $config = require $file;

    $env = static function (string $name): ?string {
        $v = getenv($name);
        return ($v === false || $v === '') ? null : $v;
    };
    // Analyst: Claude only. A config.php from before this version keeps working: its
    // ai.providers.claude block is read when the flat ai.* keys are missing; entries for
    // other providers are ignored.
    $legacy = $config['ai']['providers']['claude'] ?? [];
    $config['ai']['api_key'] = $env('ANTHROPIC_API_KEY') ?? ($config['ai']['api_key'] ?? ($legacy['api_key'] ?? ''));
    $config['ai']['model'] = $env('ANTHROPIC_MODEL') ?? ($config['ai']['model'] ?? ($legacy['model'] ?? 'claude-opus-5-5'));
    $config['ai']['url'] = $config['ai']['url'] ?? ($legacy['url'] ?? 'https://api.anthropic.com/v1/messages');
    $config['ai'] += ['max_tokens' => 1200, 'max_steps' => 6, 'per_ip_per_hour' => 15, 'daily_claude_requests' => 200];
    unset($config['ai']['providers'], $config['ai']['default'], $config['ai']['rate_limit_per_hour']);
    // Voice: ElevenLabs only (text-to-speech and speech-to-text).
    $config['voice']['elevenlabs'] = ($config['voice']['elevenlabs'] ?? []) + ['api_key' => '', 'voice_id' => '', 'tts_model' => 'eleven_multilingual_v2', 'stt_model' => 'scribe_v1'];
    $config['voice']['elevenlabs']['api_key'] = $env('ELEVENLABS_API_KEY') ?? $config['voice']['elevenlabs']['api_key'];
    $config['voice']['elevenlabs']['voice_id'] = $env('ELEVENLABS_VOICE_ID') ?? $config['voice']['elevenlabs']['voice_id'];
    $config['voice'] += ['tts_per_ip_per_hour' => 20, 'tts_chars_per_day' => 60000, 'stt_per_ip_per_hour' => 10, 'stt_per_day' => 60];
    return $config;
}
