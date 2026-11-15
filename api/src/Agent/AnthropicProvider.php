<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Agent;

use LunarNav\Http\HttpClient;
use RuntimeException;

/**
 * Claude via the Anthropic Messages API (raw HTTP; the project runs on plain PHP hosting
 * without Composer) with a manual tool-use loop.
 *
 * Prompt caching: the tool definitions and the system prompt are the same on every request,
 * so the last system block carries an explicit cache_control breakpoint (it caches tools +
 * system together), and the request also sets top-level automatic caching so the growing
 * tool loop reuses its own prefix between steps. If the API rejects cache_control, the request
 * is sent again without it and caching stays off for the rest of this process.
 */
final class AnthropicProvider implements Provider
{
    private static bool $cacheControlRejected = false;

    /** @var callable():void|null called before every API request (may throw to stop) */
    private $beforeRequest;
    /** @var callable(array):void|null called with the usage block of every response */
    private $afterRequest;

    public function __construct(
        private string $apiKey,
        private string $model,
        private string $url = 'https://api.anthropic.com/v1/messages',
        private int $maxTokens = 1200,
        private ?HttpClient $http = null,
        ?callable $beforeRequest = null,
        ?callable $afterRequest = null
    ) {
        if ($this->apiKey === '') {
            throw new RuntimeException('Claude is not configured (ANTHROPIC_API_KEY).');
        }
        $this->http ??= new HttpClient(90);
        $this->beforeRequest = $beforeRequest;
        $this->afterRequest = $afterRequest;
    }

    /** The request body for one step (public for tests). */
    public function payload(string $system, array $toolSpec, array $messages, bool $cache): array
    {
        $systemBlock = ['type' => 'text', 'text' => $system];
        if ($cache) {
            $systemBlock['cache_control'] = ['type' => 'ephemeral'];
        }
        $p = [
            'model' => $this->model,
            'max_tokens' => $this->maxTokens,
            'system' => [$systemBlock],
            'tools' => $toolSpec,
            'messages' => $messages,
        ];
        if ($cache) {
            $p['cache_control'] = ['type' => 'ephemeral'];
        }
        return $p;
    }

    public function run(string $system, array $history, string $user, array $tools, callable $execute, int $maxSteps): array
    {
        $toolSpec = array_map(static fn($t) => ['name' => $t['name'], 'description' => $t['description'], 'input_schema' => $t['schema']], $tools);
        $messages = [];
        foreach ($history as $h) {
            $messages[] = ['role' => $h['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string) $h['content']];
        }
        $messages[] = ['role' => 'user', 'content' => $user];

        for ($step = 1; $step <= $maxSteps; $step++) {
            $res = $this->request($system, $toolSpec, $messages);
            if (($res['stop_reason'] ?? '') === 'refusal') {
                return ['text' => 'The model declined to answer this request.', 'steps' => $step, 'model' => $this->model];
            }
            $content = $res['content'] ?? [];
            // The whole content (thinking blocks included) goes back unchanged.
            $messages[] = ['role' => 'assistant', 'content' => $content];
            $toolUses = array_values(array_filter($content, static fn($b) => ($b['type'] ?? '') === 'tool_use'));
            if (!$toolUses || ($res['stop_reason'] ?? '') !== 'tool_use') {
                $text = implode("\n", array_map(static fn($b) => $b['text'] ?? '', array_filter($content, static fn($b) => ($b['type'] ?? '') === 'text')));
                return ['text' => trim($text), 'steps' => $step, 'model' => $this->model];
            }
            $results = [];
            foreach ($toolUses as $tu) {
                $out = $execute((string) $tu['name'], (array) ($tu['input'] ?? []));
                $results[] = ['type' => 'tool_result', 'tool_use_id' => $tu['id'], 'content' => json_encode($out, JSON_UNESCAPED_SLASHES)];
            }
            // All results of one turn in a single user message.
            $messages[] = ['role' => 'user', 'content' => $results];
        }
        return ['text' => 'Stopped after the maximum number of steps. The tool results are listed in the panel; ask a narrower question for a written summary.', 'steps' => $maxSteps, 'model' => $this->model];
    }

    private function request(string $system, array $toolSpec, array $messages): array
    {
        if ($this->beforeRequest) {
            ($this->beforeRequest)();
        }
        $headers = ['x-api-key' => $this->apiKey, 'anthropic-version' => '2023-06-01'];
        try {
            $res = $this->http->postJson($this->url, $this->payload($system, $toolSpec, $messages, !self::$cacheControlRejected), $headers);
        } catch (RuntimeException $e) {
            if (self::$cacheControlRejected || !str_contains($e->getMessage(), 'cache_control')) {
                throw $e;
            }
            self::$cacheControlRejected = true; // this API version does not accept it: carry on without caching
            $res = $this->http->postJson($this->url, $this->payload($system, $toolSpec, $messages, false), $headers);
        }
        if ($this->afterRequest) {
            ($this->afterRequest)((array) ($res['usage'] ?? []));
        }
        return $res;
    }

    /** For tests: forget a previous rejection. */
    public static function resetCacheControl(): void
    {
        self::$cacheControlRejected = false;
    }
}
