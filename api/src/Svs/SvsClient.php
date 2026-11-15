<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Svs;

use LunarNav\Cache\Cache;
use LunarNav\Http\HttpClient;
use Throwable;

/**
 * Context visualizations from NASA's Scientific Visualization Studio (SVS).
 * Reads the public SVS API, keeps only what the page shows, caches for 30 days,
 * and falls back to the curated title/link when SVS cannot be reached.
 */
final class SvsClient
{
    private const TTL = 30 * 86400;

    /** @var callable|null test hook: fn(int $id): array decoded SVS JSON */
    private $fetcher;

    public function __construct(
        private Cache $cache,
        private string $catalogFile,
        private string $base = 'https://svs.gsfc.nasa.gov/api/',
        ?callable $fetcher = null
    ) {
        $this->fetcher = $fetcher;
    }

    public function list(): array
    {
        $cat = json_decode((string) @file_get_contents($this->catalogFile), true) ?: ['items' => []];
        $out = [];
        foreach ($cat['items'] as $item) {
            $one = $this->one($item);
            // Cleaned on the way out too, so summaries cached before the cleaner existed are fixed.
            $one['summary'] = self::cleanSummary($one['summary'] ?? null);
            $out[] = $one;
        }
        return ['source' => "NASA's Scientific Visualization Studio", 'items' => $out];
    }

    private function one(array $item): array
    {
        $key = 'svs:v1:' . (int) $item['id'];
        $hit = $this->cache->get($key);
        if ($hit !== null && (time() - (int) ($hit['fetched'] ?? 0)) < self::TTL) {
            return $hit['data'];
        }
        try {
            $raw = $this->fetcher ? ($this->fetcher)((int) $item['id']) : $this->fetch((int) $item['id']);
            $data = self::normalise($raw, $item);
            $this->cache->set($key, ['fetched' => time(), 'data' => $data]);
            return $data;
        } catch (Throwable $e) {
            if ($hit !== null) {
                return $hit['data']; // stale beats nothing
            }
            $fallback = ['id' => (int) $item['id'], 'topic' => $item['topic'] ?? null, 'title' => $item['title'], 'url' => $item['url'], 'summary' => null, 'image' => null, 'release_date' => null, 'live' => false];
            // retry after an hour rather than on every page view
            $this->cache->set($key, ['fetched' => time() - self::TTL + 3600, 'data' => $fallback]);
            return $fallback;
        }
    }

    private function fetch(int $id): array
    {
        $res = (new HttpClient(8))->request('GET', $this->base . $id);
        if ($res['status'] !== 200) {
            throw new \RuntimeException('SVS HTTP ' . $res['status']);
        }
        $json = json_decode($res['body'], true);
        if (!is_array($json) || !isset($json['title'])) {
            throw new \RuntimeException('Unexpected SVS response');
        }
        return $json;
    }

    public static function normalise(array $j, array $item): array
    {
        $img = $j['main_image'] ?? null;
        $text = (string) self::cleanSummary(trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags((string) ($j['description'] ?? '')), ENT_QUOTES | ENT_HTML5))));
        $url = (string) ($j['url'] ?? $item['url']);
        return [
            'id' => (int) ($j['id'] ?? $item['id']),
            'topic' => $item['topic'] ?? null,
            'title' => (string) ($j['title'] ?? $item['title']),
            'url' => preg_replace('#^http://#', 'https://', $url),
            'summary' => $text !== '' ? $text : null,
            'release_date' => isset($j['release_date']) ? substr((string) $j['release_date'], 0, 10) : null,
            'image' => is_array($img) && !empty($img['url']) ? [
                'url' => preg_replace('#^http://#', 'https://', (string) $img['url']),
                'width' => $img['width'] ?? null,
                'height' => $img['height'] ?? null,
                'alt' => $img['alt_text'] ?? '',
            ] : null,
            'live' => true,
        ];
    }

    /**
     * Keeps only the descriptive prose of an SVS description: drops the media file lists
     * ("|| name.jpg (1024x576) [38.5 KB] ||"), music credits and download notes, and ends at a
     * whole sentence. Returns null when nothing readable is left (the card then shows the title only).
     */
    public static function cleanSummary(?string $text): ?string
    {
        if ($text === null) return null;
        $t = str_replace("\u{00A0}", ' ', $text);
        $cut = strpos($t, '||');
        if ($cut !== false) $t = substr($t, 0, $cut);
        $t = preg_replace('/([.!?])(?=[A-Z])/u', '$1 ', $t);                       // "regions.Music" → "regions. Music"
        $t = preg_replace('/\s*\b(Music|Narration|Audio)\b[^.]*\b(provided|courtesy|by)\b.*$/iu', '', $t);
        $t = preg_replace('/[^.!?]*\b(can be downloaded|download(ed)?|files? (are|is) available)\b[^.!?]*[.!?]?/iu', '', $t);
        $t = preg_replace('/\S+\.(jpg|jpeg|png|tif|tiff|mp4|mov|webm|exr|txt|json)\b(\s*\(\d+x\d+\))?(\s*\[[^\]]*\])?/iu', '', $t);
        $t = trim(preg_replace('/\s+/', ' ', $t), " \t|…");
        if (mb_strlen($t) > 280) {
            $t = mb_substr($t, 0, 280);
            $end = max(mb_strrpos($t, '. ') ?: 0, mb_strrpos($t, '! ') ?: 0, mb_strrpos($t, '? ') ?: 0);
            $t = $end > 80 ? mb_substr($t, 0, $end + 1) : rtrim(mb_substr($t, 0, mb_strrpos($t, ' ') ?: 277)) . '…';
        }
        if (!preg_match('/[.!?…]$/u', $t) && $t !== '') {
            // A sentence cut by an earlier truncation: keep whole sentences only, if any.
            $end = max(mb_strrpos($t, '.') ?: 0, mb_strrpos($t, '!') ?: 0, mb_strrpos($t, '?') ?: 0);
            $t = $end > 40 ? mb_substr($t, 0, $end + 1) : $t;
        }
        return mb_strlen(preg_replace('/[^\p{L}]/u', '', $t)) >= 3 ? $t : null;
    }
}
