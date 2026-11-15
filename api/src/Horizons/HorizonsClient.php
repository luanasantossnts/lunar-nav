<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Horizons;

use LunarNav\Cache\Cache;
use LunarNav\Http\HttpClient;
use RuntimeException;

/**
 * Topocentric azimuth/elevation of the Sun or Earth for an observer on the lunar
 * surface, from the JPL Horizons API. Results are cached forever (ephemerides do
 * not change), keyed by every request parameter.
 */
final class HorizonsClient
{
    public const SUN = '10';
    public const EARTH = '399';
    public const MOON = '301';

    /** @var callable|null test hook: fn(array $params): string returning Horizons "result" text */
    private $fetcher;

    /** Shown in every result's provenance. */
    public string $label = 'JPL Horizons API';

    public function __construct(
        private Cache $cache,
        private string $url = 'https://ssd.jpl.nasa.gov/api/horizons.api',
        private int $timeout = 60,
        ?callable $fetcher = null
    ) {
        $this->fetcher = $fetcher;
    }

    /**
     * @param array{lat:float,lon:float,alt_km:float} $site
     * @return array{rows:list<array{0:int,1:float,2:float}>, params:array, cached:bool}
     */
    public function series(string $body, array $site, int $startTs, int $stopTs, int $stepMinutes): array
    {
        if ($stopTs <= $startTs) {
            throw new RuntimeException('Stop time must be after start time.');
        }
        $params = [
            'format' => 'json',
            'COMMAND' => "'{$body}'",
            'OBJ_DATA' => "'NO'",
            'MAKE_EPHEM' => "'YES'",
            'EPHEM_TYPE' => "'OBSERVER'",
            'CENTER' => "'coord@301'",
            'COORD_TYPE' => "'GEODETIC'",
            'SITE_COORD' => sprintf("'%.6f,%.6f,%.4f'", self::lon360($site['lon']), $site['lat'], $site['alt_km'] ?? 0.0),
            'START_TIME' => "'" . gmdate('Y-m-d H:i', $startTs) . "'",
            'STOP_TIME' => "'" . gmdate('Y-m-d H:i', $stopTs) . "'",
            'STEP_SIZE' => "'{$stepMinutes} m'",
            'QUANTITIES' => "'4'",
            'APPARENT' => "'AIRLESS'",
            'ANG_FORMAT' => "'DEG'",
            'CSV_FORMAT' => "'YES'",
            'CAL_FORMAT' => "'CAL'",
            'TIME_DIGITS' => "'MINUTES'",
            'EXTRA_PREC' => "'YES'",
        ];
        return $this->cached($params);
    }

    /**
     * Azimuth/elevation of the Moon seen from an Earth station that Horizons knows by
     * name (e.g. 'DSS-14@399'). Same caching rule as series(): keyed by every parameter.
     * @return array{rows:list<array{0:int,1:float,2:float}>, params:array, cached:bool}
     */
    public function stationSeries(string $center, int $startTs, int $stopTs, int $stepMinutes): array
    {
        if ($stopTs <= $startTs) {
            throw new RuntimeException('Stop time must be after start time.');
        }
        if (!preg_match('/^[A-Za-z0-9-]{1,20}@399$/', $center)) {
            throw new RuntimeException('Invalid station centre: ' . $center);
        }
        $params = [
            'format' => 'json',
            'COMMAND' => "'" . self::MOON . "'",
            'OBJ_DATA' => "'NO'",
            'MAKE_EPHEM' => "'YES'",
            'EPHEM_TYPE' => "'OBSERVER'",
            'CENTER' => "'{$center}'",
            'START_TIME' => "'" . gmdate('Y-m-d H:i', $startTs) . "'",
            'STOP_TIME' => "'" . gmdate('Y-m-d H:i', $stopTs) . "'",
            'STEP_SIZE' => "'{$stepMinutes} m'",
            'QUANTITIES' => "'4'",
            'APPARENT' => "'AIRLESS'",
            'ANG_FORMAT' => "'DEG'",
            'CSV_FORMAT' => "'YES'",
            'CAL_FORMAT' => "'CAL'",
            'TIME_DIGITS' => "'MINUTES'",
            'EXTRA_PREC' => "'YES'",
        ];
        return $this->cached($params);
    }

    /** Cache lookup, else fetch and store. The key covers every request parameter. */
    private function cached(array $params): array
    {
        $key = 'horizons:v1:' . json_encode($params);
        $hit = $this->cache->get($key);
        if ($hit !== null && isset($hit['rows'])) {
            return ['rows' => $hit['rows'], 'params' => $params, 'cached' => true];
        }

        $text = $this->fetcher ? ($this->fetcher)($params) : $this->fetch($params);
        $rows = HorizonsParser::parse($text);
        $this->cache->set($key, ['rows' => $rows, 'fetched_at' => gmdate('c')]);
        return ['rows' => $rows, 'params' => $params, 'cached' => false];
    }

    private function fetch(array $params): string
    {
        $http = new HttpClient($this->timeout);
        $res = $http->request('GET', $this->url . '?' . http_build_query($params));
        if ($res['status'] !== 200) {
            throw new RuntimeException('JPL Horizons returned HTTP ' . $res['status']);
        }
        $json = json_decode($res['body'], true);
        if (!is_array($json) || !isset($json['result'])) {
            throw new RuntimeException('Unexpected Horizons response: ' . substr($res['body'], 0, 300));
        }
        if (!empty($json['error'])) {
            throw new RuntimeException('Horizons error: ' . $json['error']);
        }
        return (string) $json['result'];
    }

    public static function lon360(float $lon): float
    {
        $l = fmod($lon, 360.0);
        return $l < 0 ? $l + 360.0 : $l;
    }
}
