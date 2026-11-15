<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Voice;

use CURLFile;
use LunarNav\Http\ApiError;
use LunarNav\Http\HttpClient;
use RuntimeException;

/**
 * Text-to-speech and speech-to-text, both ElevenLabs.
 *
 * TTS is cached permanently as MP3 files: the file name is a hash of the spoken text,
 * voice, model and language, so the same text is never paid for twice. What is spoken is
 * decided here (not in the browser), so the app and bin/warm-analyst.php produce the same
 * text and therefore the same file: the summary (Conclusion + Trade-off, ≤ 900 characters)
 * or the full answer (≤ 2 500 characters), without tables, citations or Markdown.
 */
final class Voice
{
    public const SUMMARY_MAX = 900;
    public const FULL_MAX = 2500;
    public const STT_MAX_BYTES = 2_000_000;
    public const STT_MAX_SECONDS = 30;

    private string $ttsDir;

    public function __construct(private array $config, private ?HttpClient $http = null, ?string $ttsDir = null)
    {
        $this->http ??= new HttpClient(90);
        $this->ttsDir = $ttsDir ?? (string) ($config['voice']['tts_cache_path'] ?? (LUNARNAV_ROOT . '/data/cache/tts'));
    }

    /* ---------- What is spoken ---------- */

    /** Markdown answer → plain speakable text: no tables, citations, headings, emphasis or links. */
    public static function plain(string $md): string
    {
        $lines = [];
        foreach (preg_split('/\R/u', $md) as $l) {
            if (preg_match('/^\s*\|/u', $l)) continue;              // table rows
            $l = preg_replace('/^\s{0,3}#{1,6}\s*/u', '', $l);       // headings
            $l = preg_replace('/^\s*[-*+]\s+/u', '', $l);             // bullets
            $l = preg_replace('/^\s*\d+\.\s+/u', '', $l);             // numbered lists
            $lines[] = $l;
        }
        $t = implode("\n", $lines);
        $t = preg_replace('/\[(\d+)\]/u', '', $t);                    // citations [n]
        $t = preg_replace('/\[([^\]]+)\]\([^)]+\)/u', '$1', $t);      // links
        $t = preg_replace('/(\*\*|__|\*|_|`)/u', '', $t);             // emphasis, code
        $t = preg_replace('/[ \t]+([.,;:!?)])/u', '$1', $t);           // space left before punctuation
        $t = preg_replace('/[ \t]{2,}/u', ' ', $t);
        $t = preg_replace('/\n{3,}/u', "\n\n", $t);
        return trim((string) $t);
    }

    /** Cuts at the last sentence end before $max characters (or the last space). */
    public static function clip(string $t, int $max): string
    {
        $t = trim($t);
        if (mb_strlen($t) <= $max) return $t;
        $cut = mb_substr($t, 0, $max);
        $end = max((int) mb_strrpos($cut, '. '), (int) mb_strrpos($cut, '! '), (int) mb_strrpos($cut, '? '), (int) mb_strrpos($cut, ".\n"));
        if ($end > $max * 0.5) return mb_substr($cut, 0, $end + 1);
        $sp = mb_strrpos($cut, ' ');
        return rtrim(mb_substr($cut, 0, $sp ?: $max), ' ,;:') . '…';
    }

    /**
     * The spoken summary: the paragraphs labelled Conclusion/Conclusão/Conclusión and Trade-off,
     * up to the Assumptions/Premissas/Supuestos label; without labels, the first paragraph.
     */
    public static function summary(string $md): string
    {
        $label = static fn(string $words) => '/(?:^|\n)\s*(?:\*\*|__)?\s*(?:' . $words . ')\s*:?\s*(?:\*\*|__)?\s*:?/iu';
        $start = $label('conclusion|conclusão|conclusao|conclusión|conclusion');
        $stop = $label('assumptions|premissas|supuestos|premisas');
        $text = $md;
        if (preg_match($start, $md, $m, PREG_OFFSET_CAPTURE)) {
            $text = substr($md, $m[0][1]);
        }
        if (preg_match($stop, $text, $m, PREG_OFFSET_CAPTURE) && $m[0][1] > 0) {
            $text = substr($text, 0, $m[0][1]);
        }
        $plain = self::plain($text);
        if ($plain === '' || !preg_match($start, $md)) {
            // No labels: the first paragraph that is not a table.
            $paras = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/u', self::plain($md))), static fn($p) => $p !== ''));
            $plain = $paras[0] ?? '';
        }
        return self::clip($plain, self::SUMMARY_MAX);
    }

    public static function spoken(string $answer, string $part): string
    {
        return $part === 'full' ? self::clip(self::plain($answer), self::FULL_MAX) : self::summary($answer);
    }

    /* ---------- Text-to-speech, cached ---------- */

    public function configured(): bool
    {
        $c = $this->config['voice']['elevenlabs'] ?? [];
        return ($c['api_key'] ?? '') !== '' && ($c['voice_id'] ?? '') !== '';
    }

    public function ttsHash(string $text, string $lang): string
    {
        $c = $this->config['voice']['elevenlabs'] ?? [];
        return hash('sha256', json_encode([$text, (string) ($c['voice_id'] ?? ''), (string) ($c['tts_model'] ?? ''), $lang], JSON_UNESCAPED_UNICODE));
    }

    public function ttsPath(string $hash): string
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $hash)) {
            throw new ApiError('bad_request', 'Unknown audio file.', 404);
        }
        return $this->ttsDir . '/' . substr($hash, 0, 2) . '/' . $hash . '.mp3';
    }

    /**
     * Returns the cached file for $text, generating it once. $beforeReal runs only when a real
     * ElevenLabs call is about to happen (it may throw to stop, e.g. at the daily limit).
     * @return array{hash:string, cached:bool, chars:int}
     */
    public function speakCached(string $text, string $lang, ?callable $beforeReal = null): array
    {
        $text = trim($text);
        if ($text === '') {
            throw new ApiError('bad_request', 'Nothing to speak.', 400);
        }
        $hash = $this->ttsHash($text, $lang);
        $path = $this->ttsPath($hash);
        if (is_file($path) && filesize($path) > 0) {
            return ['hash' => $hash, 'cached' => true, 'chars' => mb_strlen($text)];
        }
        if (!$this->configured()) {
            throw new ApiError('tts_unavailable', 'Text-to-speech is not configured.', 503);
        }
        if ($beforeReal) {
            $beforeReal(mb_strlen($text));
        }
        $mp3 = $this->synthesize($text);
        if (!is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        file_put_contents($tmp, $mp3);
        rename($tmp, $path);
        return ['hash' => $hash, 'cached' => false, 'chars' => mb_strlen($text)];
    }

    /** @return string MP3 bytes */
    private function synthesize(string $text): string
    {
        $c = $this->config['voice']['elevenlabs'];
        $res = $this->http->request('POST', 'https://api.elevenlabs.io/v1/text-to-speech/' . rawurlencode($c['voice_id']), [
            'xi-api-key' => $c['api_key'],
            'Content-Type' => 'application/json',
            'Accept' => 'audio/mpeg',
        ], json_encode(['text' => $text, 'model_id' => $c['tts_model'] ?? 'eleven_multilingual_v2']));
        if ($res['status'] >= 400 || $res['body'] === '') {
            throw new ApiError('tts_unavailable', 'Text-to-speech is not available right now.', 502);
        }
        return $res['body'];
    }

    /* ---------- Speech-to-text ---------- */

    public function sttConfigured(): bool
    {
        return ($this->config['voice']['elevenlabs']['api_key'] ?? '') !== '';
    }

    /** Checks size and duration before any call; throws a coded error when too long. */
    public static function checkClip(int $bytes, float $seconds): void
    {
        if ($bytes <= 0) {
            throw new ApiError('stt_empty', 'No audio was received.', 400);
        }
        if ($bytes > self::STT_MAX_BYTES || $seconds > self::STT_MAX_SECONDS + 0.5) {
            throw new ApiError('stt_too_long', 'Recordings are limited to 30 seconds.', 413);
        }
    }

    public function transcribe(string $path, string $mime, string $lang): string
    {
        if (!$this->sttConfigured()) {
            throw new ApiError('stt_unavailable', 'Speech input is not configured.', 503);
        }
        $c = $this->config['voice']['elevenlabs'];
        $res = $this->http->request('POST', 'https://api.elevenlabs.io/v1/speech-to-text', ['xi-api-key' => $c['api_key']], null, [
            'file' => new CURLFile($path, $mime ?: 'audio/webm', 'speech.webm'),
            'model_id' => $c['stt_model'] ?? 'scribe_v1',
            'language_code' => $lang,
        ]);
        $json = json_decode($res['body'], true);
        if ($res['status'] >= 400 || !is_array($json)) {
            throw new ApiError('stt_unavailable', 'Speech input is not available right now.', 502);
        }
        return trim((string) ($json['text'] ?? ''));
    }
}
