<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Agent;

use LunarNav\Cache\Cache;
use LunarNav\Http\ApiError;
use LunarNav\Metrics\Power;
use LunarNav\Usage\Usage;
use Throwable;

/**
 * The Analyst: answers one question with Claude and the Lunar Nav tools, recording every
 * tool call (arguments, compact result, duration) for the on-screen trace.
 *
 * Cost controls: identical questions (same normalised text, language, mode, scenario,
 * conversation, method version and model) are answered from the app cache for 90 days;
 * the global daily cap counts real Claude API requests only (cache hits are free).
 */
final class Analyst
{
    public const CACHE_TTL = 90 * 86400;
    public const MAX_QUESTION = 500;
    private const LANGS = ['en' => 'English', 'es' => 'Spanish', 'pt' => 'Brazilian Portuguese'];

    private ?Provider $provider;

    public function __construct(private array $config, private Tools $tools, private Cache $cache, private Usage $usage, ?Provider $provider = null, private ?\LunarNav\Http\HttpClient $http = null)
    {
        $this->provider = $provider;
    }

    public function model(): string
    {
        return (string) ($this->config['ai']['model'] ?? 'claude-opus-5-5');
    }

    /** Lower case, single spaces, trimmed. */
    public static function normalize(string $q): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $q)));
    }

    /** The scenario as sent by the app, reduced to known fields with fixed types and defaults. */
    public static function canonicalScenario(array $s): array
    {
        $id = static fn($v) => is_string($v) && preg_match('/^[a-z0-9_]{1,64}$/', $v) ? $v : null;
        $start = is_string($s['start'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s['start']) ? $s['start'] : '2030-07-01';
        $power = Power::params(is_array($s['power'] ?? null) ? array_intersect_key($s['power'], array_flip(['panel_w', 'orientation', 'load_w', 'survival_w', 'dod', 'wh_per_kg'])) : []);
        ksort($power);
        return [
            'a' => $id($s['a'] ?? null),
            'b' => $id($s['b'] ?? null),
            'start' => $start,
            'days' => max(1, min(60, (int) ($s['days'] ?? 30))),
            'mode' => ($s['mode'] ?? '') === 'terrain' ? 'terrain' : 'geometric',
            'delay' => max(-60, min(60, (int) ($s['delay'] ?? 10))),
            'earth_margin' => round(max(0.0, min(20.0, (float) ($s['earth_margin'] ?? 0))), 2),
            'power' => $power,
        ];
    }

    /** Cache key: nothing personal (no IP, no time), only what changes the answer. */
    public function cacheKey(string $question, string $lang, string $mode, array $scenario, array $history = []): string
    {
        $h = array_map(static fn($m) => [$m['role'] === 'assistant' ? 'a' : 'u', self::normalize((string) $m['content'])], array_slice($history, -8));
        $payload = [
            'q' => self::normalize($question),
            'lang' => $lang,
            'mode' => $mode === 'learn' ? 'learn' : 'technical',
            'scenario' => self::canonicalScenario($scenario),
            'history' => $h,
            'method' => \LUNARNAV_METHOD_VERSION,
            'model' => $this->model(),
        ];
        return 'analyst:v1:' . hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /** A cached answer, or null (missing or older than 90 days). */
    public function cached(string $key): ?array
    {
        $hit = $this->cache->get($key);
        if (!is_array($hit) || !isset($hit['response'], $hit['stored_at']) || $hit['stored_at'] < time() - self::CACHE_TTL) {
            return null;
        }
        $this->usage->add(['analyst_cache_hits' => 1]);
        return $hit['response'] + ['cached' => true, 'cached_at' => gmdate('Y-m-d', (int) $hit['stored_at'])];
    }

    /** The scenario line appended to the user message (after the cached prompt prefix). */
    public static function scenarioLine(array $c): string
    {
        $p = $c['power'];
        return sprintf(
            "\n\n[Current app scenario: site A %s, site B %s, landing %s UTC, %d days, %s horizon, delay %d days, antenna margin %s°, power inputs: %s W panel (%s), %s W load, %s W survival, depth of discharge %s, %s Wh/kg.]",
            $c['a'] ?? 'not set', $c['b'] ?? 'not set', $c['start'], $c['days'], $c['mode'], $c['delay'], $c['earth_margin'],
            $p['panel_w'] ?? '?', $p['orientation'] ?? '?', $p['load_w'] ?? '?', $p['survival_w'] ?? '?', $p['dod'] ?? '?', $p['wh_per_kg'] ?? '?'
        );
    }

    public static function systemPrompt(string $lang, string $level, string $today, bool $learn = false): string
    {
        $language = self::LANGS[$lang] ?? 'English';
        // In Learn mode (or for a classroom audience) the app glossary is given as short context.
        $glossary = ($learn || $level === 'classroom') ? self::glossaryContext() : '';
        $audience = $level === 'classroom'
            ? 'Explain for secondary-school students and the public: short sentences, everyday comparisons, define terms like azimuth, elevation and libration the first time.'
            : 'Write for mission planners: precise, compact, numbers first.';
        return <<<TXT
You are the Lunar Nav analyst. You help compare lunar landing sites and dates by Sun visibility (power) and Earth visibility (direct line of sight for communication).

Rules:
- Use the tools for every number. Never state a value that did not come from a tool result in this conversation.
- After each number, cite the tool call that produced it as [n], where n is the 1-based order of your tool calls. Citation format is strict: one number per pair of brackets, e.g. [2]; several calls are written side by side, e.g. [2][4]. Never write ranges or lists inside brackets (no [2-4], [2…4], [2, 4]), never write "see below", and do not add a list of citations at the end.
- Always say which horizon model was used (geometric or terrain) and say when terrain was unavailable.
- Visibility uses the body centre. Earth visibility is a geometric line of sight to the centre of Earth's disc, not to a ground station, and not a radio link budget.
- For questions about communication or contact, cite comm (Earth in view AND a NASA Deep Space Network complex sees the Moon, with its longest gap), not only Earth in view. Say that it covers the DSN 70-m antennas only, with a minimum elevation, and is not a link budget.
- Energy and battery numbers (power_budget, or power in site_metrics) are illustrative: they depend on the stated inputs (panel power, orientation, loads, depth of discharge, Wh/kg) and assumptions (1 AU, no dust or degradation, no thermal model, no self-shadowing). Always state the inputs used and never present them as a real mission's specification.
- Keep the chosen period apart from the long-term average. Fractions in sun/earth/comm describe the chosen dates only. reference_long_term is NASA PGDA's 18.6-year average (any fraction of the disc visible, PGDA resolution as given); call it "long-term average (NASA PGDA)" and never mix it with the period's values.
- Number format: tool results already give shares as percentages with one decimal (fields named percent, *_percent or *_pct) durations in hours with one decimal, and elevations and azimuths in degrees with two decimals. Write them exactly so, with the unit: "99.8 %", "363.4 h", "1.53°". Never write a raw fraction such as 0.9976, and never add or drop decimals.
- When you cite a percentage, also give its range when the tool returned one: disc_range (first limb … full disc) and position_spread (P10–P90 within 300 m of the site, terrain horizon). Never present the centre value as exact; say it is the centre of that range.
- In terrain mode, whenever position_spread is available for a site, give its ±300 m range (P10–P90) for sunlight, and for Earth in view when Earth matters to the question, written like "48.1–73.3 % within 300 m [1]". Say that landing precision matters when this range is wide.
- Night lengths are measured in full, up to 15 days beyond the period; lower_bound = the true value may be even larger (say "at least"). The *_placement fields tell where the longest night or gap lies: when started_before_period is true, say it began before the period; when ends_after_period is true, say it continues after the period. Never claim a night or gap lies entirely within the period unless both are false.
- Never claim a site is safe to land on; slopes, rocks and thermal conditions are out of scope.
- If a request cannot be answered with the tools, say so plainly.
- Keep answers under 180 words unless asked for more.
- Structure every answer in this order: a paragraph that starts with the bold label **Conclusion:** (Portuguese **Conclusão:**, Spanish **Conclusión:**); then a paragraph that starts with **Trade-off:** (the same word in all three languages); then any table or list; then **Assumptions:** (Portuguese **Premissas:**, Spanish **Supuestos:**). The Conclusion and Trade-off paragraphs are read aloud on their own, so write them as complete sentences, without tables.
- The user message may end with the current app scenario; use it when the question does not say otherwise.
- {$audience}
- Reply in {$language}.

Today is {$today}. Dates are UTC.{$glossary}
TXT;
    }

    /** The app glossary (data/glossary.json, the English Help text) as a short prompt block. */
    public static function glossaryContext(): string
    {
        $f = LUNARNAV_ROOT . '/data/glossary.json';
        $g = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
        if (!is_array($g) || empty($g['terms'])) {
            return '';
        }
        $lines = [];
        foreach ($g['terms'] as $t) {
            $lines[] = '- ' . $t['title'] . ': ' . $t['def'];
        }
        return "\n\nGlossary (the app's own definitions; you may use them to explain terms, translated into the reply language):\n" . implode("\n", $lines);
    }

    private function provider(): Provider
    {
        if ($this->provider) {
            return $this->provider;
        }
        $ai = $this->config['ai'];
        $limit = (int) ($ai['daily_claude_requests'] ?? 200);
        return new AnthropicProvider(
            (string) ($ai['api_key'] ?? ''),
            $this->model(),
            (string) ($ai['url'] ?? 'https://api.anthropic.com/v1/messages'),
            (int) ($ai['max_tokens'] ?? 1200),
            $this->http,
            fn() => $this->usage->ensure('claude_requests', 1, $limit, 'analyst_daily'),
            fn(array $u) => $this->usage->add([
                'claude_requests' => 1,
                'claude_input_tokens' => (int) ($u['input_tokens'] ?? 0),
                'claude_output_tokens' => (int) ($u['output_tokens'] ?? 0),
                'claude_cache_write_tokens' => (int) ($u['cache_creation_input_tokens'] ?? 0),
                'claude_cache_read_tokens' => (int) ($u['cache_read_input_tokens'] ?? 0),
            ])
        );
    }

    /**
     * Answers with Claude and stores the answer under $key. $mode is 'technical' or 'learn'
     * (Learn adds the app glossary and a classroom register).
     */
    public function ask(string $question, array $history, string $lang, string $mode, array $scenario, string $key): array
    {
        $trace = [];
        $execute = function (string $name, array $args) use (&$trace): array {
            $t0 = microtime(true);
            try {
                // Percentages and hours are pre-formatted for the model (one decimal).
                $out = Tools::forModel($this->tools->execute($name, $args));
                $ok = true;
            } catch (Throwable $e) {
                $out = ['error' => $e->getMessage()];
                $ok = false;
            }
            $trace[] = ['n' => count($trace) + 1, 'tool' => $name, 'args' => $args, 'ok' => $ok, 'ms' => (int) round((microtime(true) - $t0) * 1000), 'result' => $out];
            return $out;
        };
        $learn = $mode === 'learn';
        $limit = (int) ($this->config['ai']['daily_claude_requests'] ?? 200);
        // A question needs at least 2 requests (a tool round and the answer): do not start one
        // that the daily cap would cut short.
        $this->usage->ensure('claude_requests', 2, $limit, 'analyst_daily');
        try {
            $r = $this->provider()->run(
                self::systemPrompt($lang, $learn ? 'classroom' : 'technical', gmdate('Y-m-d'), $learn),
                array_slice($history, -8),
                $question . self::scenarioLine(self::canonicalScenario($scenario)),
                Tools::definitions(),
                $execute,
                max(1, min(6, (int) ($this->config['ai']['max_steps'] ?? 6)))
            );
        } catch (ApiError $e) {
            throw $e;
        } catch (Throwable $e) {
            throw new ApiError('analyst_unavailable', 'The analyst is not available right now. Please try again later.', 502);
        }
        $this->usage->add(['claude_questions' => 1]);
        $response = [
            'answer' => $r['text'],
            'provider' => 'claude',
            'model' => $r['model'],
            'steps' => $r['steps'],
            'trace' => $trace,
            'disclosure' => 'Text generated by an AI model from Lunar Nav tool results (JPL Horizons, NASA LOLA).',
        ];
        if (trim($r['text']) !== '' && !str_starts_with($r['text'], 'Stopped after')) {
            $this->cache->set($key, ['stored_at' => time(), 'response' => $response]);
        }
        return $response + ['cached' => false];
    }
}
