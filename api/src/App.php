<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav;

use InvalidArgumentException;
use LunarNav\Agent\Analyst;
use LunarNav\Agent\Tools;
use LunarNav\Cache\Cache;
use LunarNav\Cache\CacheFactory;
use LunarNav\Dsn\DsnNetwork;
use LunarNav\Reference\ReferenceStore;
use LunarNav\Horizons\HorizonsClient;
use LunarNav\Http\ApiError;
use LunarNav\Http\RateLimiter;
use LunarNav\Usage\Usage;
use LunarNav\Metrics\Scenarios;
use LunarNav\Sites\SiteCatalog;
use LunarNav\Svs\SvsClient;
use LunarNav\Terrain\TerrainStore;
use LunarNav\Voice\Voice;
use Throwable;

/** HTTP front controller: routes /api/* to the services and renders JSON. */
final class App
{
    public Cache $cache;
    public SiteCatalog $sites;
    public TerrainStore $terrain;
    public Scenarios $scenarios;
    private string $terrainDir;

    public function __construct(public array $config, ?HorizonsClient $horizons = null)
    {
        $this->cache = CacheFactory::make($config);
        $this->sites = new SiteCatalog(LUNARNAV_ROOT . '/data/sites.json');
        $this->terrainDir = $config['terrain']['path'] ?? (LUNARNAV_ROOT . '/data/terrain');
        $this->terrain = new TerrainStore($this->terrainDir);
        $horizons ??= new HorizonsClient($this->cache, $config['horizons']['url'], (int) $config['horizons']['timeout']);
        $dsnFile = $config['dsn']['path'] ?? (LUNARNAV_ROOT . '/data/dsn.json');
        $dsn = is_file($dsnFile) ? new DsnNetwork($dsnFile) : null;
        $this->scenarios = new Scenarios($horizons, $this->terrain, (int) ($config['horizons']['max_days'] ?? 200), $this->cache, $dsn);
        $this->scenarios->setReference(new ReferenceStore($config['reference']['path'] ?? (LUNARNAV_ROOT . '/data/pgda')));
    }

    /** Sites shown in the Charts tab: those with a terrain horizon, plus Chandrayaan-3 (geometric). */
    public const CHART_SITES = ['shackleton_ridge', 'im2_athena', 'malapert_m1', 'im1_odysseus', 'chandrayaan3'];

    /**
     * Month-by-month Sun and Earth visibility over a year, for the Charts tab. Read-only on
     * the cache (nothing is written): it uses a Horizons client that never calls the network, so a site whose
     * series are not cached is reported as unavailable instead of triggering a new request.
     */
    public function chartsYear(int $year): array
    {
        $cacheOnly = new HorizonsClient($this->cache, 'cache-only', 1, static function (): string {
            throw new \RuntimeException('not in cache');
        });
        $sc = new Scenarios($cacheOnly, $this->terrain, (int) ($this->config['horizons']['max_days'] ?? 200), $this->cache, null);
        $blocks = \LunarNav\Reference\PgdaComparison::blocks($year);
        $out = [];
        $complete = true;
        foreach (self::CHART_SITES as $id) {
            $site = $this->sites->resolve(['site' => $id]);
            $mode = null;
            try {
                $mode = $this->terrain->mask($id) ? 'terrain' : 'geometric';
                $out[] = ['site' => $id, 'name' => $site['name'], 'mode' => $mode, 'available' => true] + $sc->monthly($site, $year, $mode, $blocks);
            } catch (Throwable $e) {
                $complete = false;
                $out[] = ['site' => $id, 'name' => $site['name'], 'mode' => $mode, 'available' => false, 'reason' => $mode === null ? 'terrain unreadable' : 'not in cache'];
            }
        }
        // Not stored: it takes ~0.1 s from the cached series, and the Charts tab never writes to the cache.
        return ['year' => $year, 'visibility' => 'body centre', 'step_minutes' => 60, 'source' => 'JPL Horizons API (cached)', 'complete' => $complete, 'sites' => $out];
    }

    public static function route(): string
    {
        if (!empty($_GET['route'])) {
            return '/' . trim((string) $_GET['route'], '/');
        }
        $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
        $pos = strpos($path, '/api/');
        $path = $pos === false ? $path : substr($path, $pos + 4);
        return '/' . trim($path, '/');
    }

    public function handle(string $method, string $route, array $q, array $body): array
    {
        $num = static fn(string $k, float $def, float $min, float $max) => isset($q[$k]) && is_numeric($q[$k]) ? max($min, min($max, (float) $q[$k])) : $def;
        $step = (int) $num('step', 60, 1, 240);
        $mode = ($q['mode'] ?? 'geometric') === 'terrain' ? 'terrain' : 'geometric';
        $sunM = $num('sun_margin', 0, -5, 20);
        $earthM = $num('earth_margin', 0, -5, 20);
        // DSN contact is on by default; dsn=0 turns it off. POST bodies carry the same keys.
        $dsnSrc = $method === 'POST' ? $body : $q;
        $this->scenarios->configureDsn(
            !isset($dsnSrc['dsn']) || !in_array((string) $dsnSrc['dsn'], ['0', 'false', ''], true),
            isset($dsnSrc['dsn_min_el']) && is_numeric($dsnSrc['dsn_min_el']) ? (float) $dsnSrc['dsn_min_el'] : null
        );
        // Power-model inputs: pw_panel_w, pw_orientation, pw_load_w, pw_survival_w, pw_dod, pw_wh_per_kg.
        $pw = [];
        foreach ($dsnSrc as $k => $v) {
            if (is_string($k) && str_starts_with($k, 'pw_') && is_scalar($v)) {
                $pw[substr($k, 3)] = $v;
            }
        }
        $this->scenarios->configurePower($pw);

        switch ("{$method} {$route}") {
            case 'GET /health':
                // Booleans only: no usage figures, models or limits are exposed here.
                return ['ok' => true, 'method_version' => LUNARNAV_METHOD_VERSION, 'cache' => $this->config['cache']['driver'] ?? 'file', 'providers' => ['claude' => ($this->config['ai']['api_key'] ?? '') !== ''], 'voice' => $this->voiceStatus()];

            case 'GET /sites':
                $all = $this->sites->all();
                foreach ($all as &$s) {
                    $s['terrain'] = $this->terrain->availability($s['id']);
                }
                return ['sites' => $all, 'default_pair' => $this->sites->defaultPair()];

            case 'GET /terrain':
                $site = $this->sites->resolve($q);
                $mask = $site['id'] !== 'custom' ? $this->terrain->mask($site['id']) : null;
                return ['site' => $site['id'], 'availability' => $this->terrain->availability($site['id']), 'mask' => $mask?->toArray()];

            case 'GET /ephemeris':
                $site = $this->sites->resolve($q);
                $r = $this->scenarios->run($site, Tools::parseDate((string) ($q['start'] ?? '')), (int) $num('days', 30, 1, 60), $step, $mode, $sunM, $earthM, true);
                return ['site' => $site, 'series' => $r['series'], 'provenance' => $r['provenance']];

            case 'GET /metrics':
                $site = $this->sites->resolve($q);
                $start = Tools::parseDate((string) ($q['start'] ?? ''));
                $days = (int) $num('days', 30, 1, 60);
                $r = $this->scenarios->run($site, $start, $days, $step, $mode, $sunM, $earthM, !empty($q['series']));
                $r['terrain'] = $this->terrain->availability($site['id']);
                if (!empty($q['spread'])) {
                    $r['position_spread'] = $this->scenarios->positionSpread($site, $start, $days, $step, $sunM, $earthM);
                }
                return $r;

            case 'POST /compare':
                $specs = [];
                foreach (array_slice((array) ($body['scenarios'] ?? []), 0, 4) as $s) {
                    $specs[] = ['site' => $this->sites->resolve((array) $s), 'start' => Tools::parseDate((string) ($s['start'] ?? '')), 'days' => max(1, min(60, (int) ($s['days'] ?? 30))), 'label' => $s['label'] ?? null];
                }
                $bm = ($body['mode'] ?? 'geometric') === 'terrain' ? 'terrain' : 'geometric';
                return $this->scenarios->compare($specs, (int) ($body['step'] ?? 60), $bm, (float) ($body['sun_margin'] ?? 0), (float) ($body['earth_margin'] ?? 0));

            case 'GET /delay':
                $site = $this->sites->resolve($q);
                return $this->scenarios->delay($site, Tools::parseDate((string) ($q['start'] ?? '')), (int) $num('days', 30, 1, 60), $num('delay_days', 10, -60, 60), $step, $mode, $sunM, $earthM);

            case 'GET /windows':
                $site = $this->sites->resolve($q);
                $constraints = [];
                foreach (['min_sun_fraction' => [0, 1], 'min_earth_fraction' => [0, 1], 'min_earth_hours_per_day' => [0, 24], 'min_both_fraction' => [0, 1], 'max_dark_hours' => [0, 2000], 'min_comm_hours_per_day' => [0, 24], 'max_battery_kwh' => [0, 100000]] as $k => [$lo, $hi]) {
                    if (isset($q[$k]) && is_numeric($q[$k])) $constraints[$k] = max($lo, min($hi, (float) $q[$k]));
                }
                return $this->scenarios->searchWindows($site, Tools::parseDate((string) ($q['from'] ?? '')), Tools::parseDate((string) ($q['to'] ?? '')), $num('duration_days', 14, 1, 60), $constraints, (int) $num('step_hours', 24, 1, 240), $step, $mode, $sunM, $earthM);

            case 'GET /charts/year':
                return $this->chartsYear((int) $num('year', 2030, 2000, 2100));

            case 'GET /sensitivity':
                $site = $this->sites->resolve($q);
                return $this->scenarios->sensitivity($site, Tools::parseDate((string) ($q['start'] ?? '')), (int) $num('days', 30, 1, 60), $step, $sunM, $earthM);

            case 'POST /analyst':
                return $this->analyst($body);

            case 'GET /svs':
                return (new SvsClient($this->cache, LUNARNAV_ROOT . '/data/svs.json'))->list();

            case 'GET /validation':
                $f = LUNARNAV_ROOT . '/data/validation.json';
                return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : ['status' => 'not run', 'checks' => []];
        }
        throw new NotFound('No route for ' . $method . ' ' . $route);
    }

    public function usage(): Usage
    {
        return new Usage($this->cache);
    }

    /** Per-client hourly allowance: only a salted hash of the client address is used, and it is deleted after 48 h. */
    private function perClient(string $bucket, int $perHour, string $code): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'cli';
        if (!(new RateLimiter($this->cache, \LunarNav\Privacy\IpSalt::resolve($this->config)))->allow($bucket, $ip, $perHour)) {
            $this->usage()->add(['limit_hits' => 1]);
            throw new ApiError($code, 'You have reached the hourly limit for this feature. Please try again later.', 429);
        }
    }

    /** POST /analyst: cached answer if there is one; otherwise Claude, within the limits. */
    public function analyst(array $body): array
    {
        $question = trim((string) ($body['question'] ?? ''));
        if ($question === '') {
            throw new ApiError('question_empty', 'Please type a question.', 400);
        }
        if (mb_strlen($question) > Analyst::MAX_QUESTION) {
            throw new ApiError('question_too_long', 'Questions are limited to 500 characters.', 400);
        }
        $history = array_values(array_filter((array) ($body['history'] ?? []), static fn($h) => is_array($h) && isset($h['role'], $h['content']) && is_string($h['content'])));
        $lang = in_array($body['lang'] ?? 'en', ['en', 'es', 'pt'], true) ? (string) $body['lang'] : 'en';
        $mode = ($body['mode'] ?? '') === 'learn' ? 'learn' : 'technical';
        $scenario = is_array($body['scenario'] ?? null) ? $body['scenario'] : [];
        $usage = $this->usage();
        $analyst = new Analyst($this->config, new Tools($this->sites, $this->scenarios), $this->cache, $usage, $this->analystProvider, $this->claudeHttp);
        $key = $analyst->cacheKey($question, $lang, $mode, $scenario, $history);
        $hit = $analyst->cached($key);
        if ($hit !== null) {
            return $hit; // free: does not count towards any limit
        }
        if (($this->config['ai']['api_key'] ?? '') === '' && $this->analystProvider === null) {
            throw new ApiError('analyst_unavailable', 'The analyst is not configured on this server.', 503);
        }
        $this->perClient('analyst', (int) ($this->config['ai']['per_ip_per_hour'] ?? 15), 'analyst_ip');
        return $analyst->ask($question, $history, $lang, $mode, $scenario, $key);
    }

    /** For tests: a scripted provider, or a fake HTTP client for the Claude API (no real calls). */
    public ?\LunarNav\Agent\Provider $analystProvider = null;
    public ?\LunarNav\Http\HttpClient $claudeHttp = null;
    /** For tests: a fake HTTP client for ElevenLabs, and a temporary MP3 folder. */
    public ?\LunarNav\Http\HttpClient $voiceHttp = null;
    public ?string $ttsDir = null;
    /** For tests: replaces the real wait between ElevenLabs retries. */
    public ?\Closure $voiceSleep = null;

    private function voiceStatus(): array
    {
        $v = $this->config['voice']['elevenlabs'] ?? [];
        return [
            'tts' => ($v['api_key'] ?? '') !== '' && ($v['voice_id'] ?? '') !== '',
            'stt' => ($v['api_key'] ?? '') !== '',
        ];
    }

    /** Streams a terrain asset (whitelisted names only). */
    public function terrainAsset(string $siteId, string $name): void
    {
        $types = ['hillshade.png' => 'image/png', 'heightmap.bin' => 'application/octet-stream', 'heightmap.json' => 'application/json', 'mask.json' => 'application/json'];
        if (!preg_match('/^[a-z0-9_]{1,64}$/', $siteId) || !isset($types[$name])) {
            throw new InvalidArgumentException('Unknown terrain asset.');
        }
        $f = $this->terrainDir . '/' . $siteId . '/' . $name;
        if (!is_file($f)) {
            throw new NotFound('Terrain asset not built for this site.');
        }
        header('Content-Type: ' . $types[$name]);
        header('Cache-Control: public, max-age=86400');
        readfile($f);
    }

    /**
     * POST /tts {text, lang, part: summary|full} → {h, cached}: the MP3 is then fetched from
     * GET /tts/file?h=… (cacheable by the browser). POST /stt (multipart: audio, lang, duration).
     */
    public function voice(string $route, array $in = [], ?array $file = null): array
    {
        $v = $this->config['voice'];
        $voice = new Voice($this->config, $this->voiceHttp, $this->ttsDir, $this->voiceSleep);
        $usage = $this->usage();
        if ($route === '/tts') {
            $this->perClient('tts', (int) ($v['tts_per_ip_per_hour'] ?? 20), 'tts_ip');
            $lang = in_array($in['lang'] ?? 'en', ['en', 'es', 'pt'], true) ? (string) $in['lang'] : 'en';
            $text = Voice::spoken((string) ($in['text'] ?? ''), ($in['part'] ?? '') === 'full' ? 'full' : 'summary');
            $daily = (int) ($v['tts_chars_per_day'] ?? 60000);
            $r = $voice->speakCached($text, $lang, fn(int $chars) => $usage->ensure('tts_chars', $chars, $daily, 'tts_daily'));
            $usage->add($r['cached'] ? ['tts_cache_hits' => 1] : ['tts_requests' => 1, 'tts_chars' => $r['chars']]);
            return ['h' => $r['hash'], 'cached' => $r['cached'], 'chars' => $r['chars']];
        }
        // Speech-to-text: size and duration first, then the hourly and daily limits.
        $seconds = max(0.0, (float) ($in['duration'] ?? 0));
        Voice::checkClip((int) ($file['size'] ?? 0), $seconds);
        $this->perClient('stt', (int) ($v['stt_per_ip_per_hour'] ?? 10), 'stt_ip');
        $usage->ensure('stt_requests', 1, (int) ($v['stt_per_day'] ?? 60), 'stt_daily');
        $lang = in_array($in['lang'] ?? 'en', ['en', 'es', 'pt'], true) ? (string) $in['lang'] : 'en';
        // The recording is only forwarded to ElevenLabs: it is never copied, and PHP's temporary
        // upload is removed right after (PHP would also remove it at the end of the request).
        try {
            $text = $voice->transcribe((string) $file['tmp_name'], (string) ($file['type'] ?? ''), $lang);
        } finally {
            if (is_uploaded_file((string) ($file['tmp_name'] ?? ''))) {
                @unlink((string) $file['tmp_name']);
            }
        }
        $usage->add(['stt_requests' => 1, 'stt_seconds' => min(Voice::STT_MAX_SECONDS, $seconds)]);
        return ['text' => $text];
    }

    /** GET /tts/file?h=… : a cached MP3, with a long browser cache (the name is a content hash). */
    public function ttsFile(string $hash): void
    {
        $path = (new Voice($this->config, null, $this->ttsDir))->ttsPath($hash);
        if (!is_file($path)) {
            throw new NotFound('Audio not found.');
        }
        header('Content-Type: audio/mpeg');
        header('Cache-Control: public, max-age=31536000, immutable');
        header('X-AI-Generated: ElevenLabs text-to-speech');
        header('Content-Length: ' . filesize($path));
        readfile($path);
    }

    public static function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function serve(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && in_array($origin, $this->config['cors_origins'] ?? [], true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Headers: Content-Type');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        }
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method === 'OPTIONS') {
            http_response_code(204);
            return;
        }
        $route = self::route();
        try {
            if ($method === 'GET' && $route === '/terrain/asset') {
                $this->terrainAsset((string) ($_GET['site'] ?? ''), (string) ($_GET['name'] ?? ''));
                return;
            }
            if ($method === 'GET' && $route === '/tts/file') {
                $this->ttsFile((string) ($_GET['h'] ?? ''));
                return;
            }
            if ($method === 'POST' && $route === '/stt') {
                self::json($this->voice('/stt', $_POST, $_FILES['audio'] ?? null));
                return;
            }
            if ($method === 'POST' && $route === '/tts') {
                $in = json_decode((string) file_get_contents('php://input'), true) ?: [];
                self::json($this->voice('/tts', $in));
                return;
            }
            $body = [];
            if ($method === 'POST') {
                $raw = (string) file_get_contents('php://input');
                $body = $raw === '' ? [] : (json_decode($raw, true) ?? throw new InvalidArgumentException('Body must be JSON.'));
            }
            self::json($this->handle($method, $route, $_GET, $body));
        } catch (InvalidArgumentException $e) {
            self::json(['error' => $e->getMessage()], 400);
        } catch (NotFound $e) {
            self::json(['error' => $e->getMessage()], 404);
        } catch (ApiError $e) {
            // A coded, polite error; the app shows it in the user's language.
            self::json(['error' => $e->getMessage(), 'code' => $e->errorCode], $e->status);
        } catch (Throwable $e) {
            self::json(['error' => $e->getMessage()], 502);
        }
    }
}

final class NotFound extends \RuntimeException
{
}
