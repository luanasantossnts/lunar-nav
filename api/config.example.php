<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
/**
 * Lunar Nav configuration.
 *
 * Copy to config.php and fill in. Secrets can also come from environment
 * variables (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, IP_SALT; optionally
 * ANTHROPIC_MODEL), which take precedence — for example from a file passed to
 * `docker run --env-file`. Never commit config.php or any key.
 */
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
        'api_key' => '',
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
            'api_key' => '',
            'voice_id' => '',
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
        // Prefer the IP_SALT environment variable; if neither is set, one is created in salt_file
        // or, by default, in a file just above the site root (outside the web root).
        'ip_salt' => '',
        'salt_file' => null,
    ],

    // Origins allowed to call the API from a browser. Same-origin deploys need nothing here.
    'cors_origins' => ['http://localhost:5173'],
];
