<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Http;

use RuntimeException;

/** Minimal HTTP client on top of curl, with a file_get_contents fallback for GET. */
class HttpClient
{
    public function __construct(private int $timeout = 60)
    {
    }

    /** @return array{status:int, body:string, headers:array<string,string>} */
    public function request(string $method, string $url, array $headers = [], ?string $body = null, ?array $multipart = null): array
    {
        if (!function_exists('curl_init')) {
            if ($method !== 'GET') {
                throw new RuntimeException('The curl extension is required for ' . $method . ' requests.');
            }
            $ctx = stream_context_create(['http' => ['timeout' => $this->timeout, 'ignore_errors' => true]]);
            $raw = @file_get_contents($url, false, $ctx);
            if ($raw === false) {
                throw new RuntimeException('Request failed: ' . $url);
            }
            $status = 200;
            foreach ($http_response_header ?? [] as $h) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                    $status = (int) $m[1];
                }
            }
            return ['status' => $status, 'body' => $raw, 'headers' => []];
        }

        $ch = curl_init($url);
        $hdrs = [];
        foreach ($headers as $k => $v) {
            $hdrs[] = $k . ': ' . $v;
        }
        $respHeaders = [];
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $hdrs,
            CURLOPT_USERAGENT => 'LunarNav/1.0 (+NASA Space Apps 2026)',
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$respHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($line);
            },
        ];
        if ($multipart !== null) {
            $opts[CURLOPT_POSTFIELDS] = $multipart;
        } elseif ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = $body;
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) {
            throw new RuntimeException('Request failed: ' . $err);
        }
        return ['status' => $status, 'body' => (string) $raw, 'headers' => $respHeaders];
    }

    public function postJson(string $url, array $payload, array $headers = []): array
    {
        $headers['Content-Type'] = 'application/json';
        $res = $this->request('POST', $url, $headers, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $json = json_decode($res['body'], true);
        if ($res['status'] >= 400) {
            $msg = is_array($json) ? json_encode($json['error'] ?? $json) : substr($res['body'], 0, 300);
            throw new RuntimeException('Upstream error ' . $res['status'] . ': ' . $msg);
        }
        if (!is_array($json)) {
            throw new RuntimeException('Upstream returned non-JSON content.');
        }
        return $json;
    }
}
