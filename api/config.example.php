<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Lunar Nav configuration.
 *
 * Copy to config.php (same folder) and fill in the five fields below. config.php is blocked from
 * the web by .htaccess and is never in the repository or the deploy zip. Environment variables
 * with the same names (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, IP_SALT;
 * optionally ANTHROPIC_MODEL) take precedence when the host provides them. Never commit a key.
 */

// Anthropic (Claude) key for the Analyst. Empty: the Analyst only answers from its cache.
$ANTHROPIC_API_KEY = '';
// ElevenLabs key for read-aloud and speech input. Empty: the browser's own voice is used.
$ELEVENLABS_API_KEY = '';
// ElevenLabs voice (public id, not a secret). The cached MP3 files were made with this voice.
$ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
// Secret for hashing client addresses (hourly limits). 64 random hex characters, e.g. from
// `php -r "echo bin2hex(random_bytes(32));"`. Empty: one is created in $PRIVATE_DIR.
$IP_SALT = '';
// Private folder OUTSIDE public_html (never served), e.g. /home/USUARIO/lunarnav-private
// on Hostinger. Holds the IP salt file when $IP_SALT is empty.
$PRIVATE_DIR = '/home/USUARIO/lunarnav-private';

return [
    'cache' => [
        // 'file' works on any host. 'mysql' uses the table created by bin/create-cache-table.sql.
        'driver' => 'file',
        'path' => __DIR__ . '/data/cache',
        'mysql' => [
            'dsn' => 'mysql:host=localhost;dbname=lunarnav;charset=utf8mb4',
            'user' => '',
            'pass' => '',
        ],
    ],

    'horizons' => [
        'url' => 'https://ssd.jpl.nasa.gov/api/horizons.api',
        'timeout' => 60,
        'max_days' => 200,      // longest series one request may ask for
    ],

    'terrain' => [
        'path' => __DIR__ . '/data/terrain',
    ],

    'ai' => [
        // The analyst uses Claude (Anthropic Messages API) only.
        'api_key' => $ANTHROPIC_API_KEY,
        // Smaller models cost less per token (see README, "Cost controls").
        'model' => 'claude-opus-5-5',
        'url' => 'https://api.anthropic.com/v1/messages',
        'max_tokens' => 1200,          // longest answer per request
        'max_steps' => 6,              // tool-use rounds per question (capped at 6)
        'per_ip_per_hour' => 15,       // questions per client per hour (cached answers are free)
        'daily_claude_requests' => 200, // real Claude API requests per day, all users (cache hits do not count)
    ],

    'voice' => [
        // ElevenLabs for both read-aloud (TTS) and speech input (STT, Scribe).
        'elevenlabs' => [
            'api_key' => $ELEVENLABS_API_KEY,
            'voice_id' => $ELEVENLABS_VOICE_ID,
            'tts_model' => 'eleven_multilingual_v2',
            'stt_model' => 'scribe_v1',
        ],
        'tts_cache_path' => __DIR__ . '/data/cache/tts', // MP3 files, kept permanently
        'tts_per_ip_per_hour' => 20,
        'tts_chars_per_day' => 60000,  // real TTS characters per day, all users (cached audio does not count)
        'stt_per_ip_per_hour' => 10,
        'stt_per_day' => 60,           // recordings of up to 30 s / 2 MB
    ],

    'privacy' => [
        // Secret used to hash client addresses for the hourly limits (records are deleted after 48 h).
        // IP_SALT (environment or the field above); if empty, one is created in salt_file, which
        // must be outside public_html (the app refuses a path inside the site).
        'ip_salt' => $IP_SALT,
        'salt_file' => rtrim($PRIVATE_DIR, '/') . '/ip-salt',
    ],

    // Origins allowed to call the API from a browser. Same-origin deploys (lunarnav.space) need
    // nothing here; for local development with the Vite server add 'http://localhost:5173'.
    'cors_origins' => [],
];
