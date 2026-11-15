<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Reference;

/**
 * Long-term reference values from NASA PGDA product 69 (Mazarico et al. 2011), prepared
 * per site by preprocess/pgda_reference.py in data/pgda/<site_id>.json: average Sun and
 * Earth visibility over ~18.6 years and the permanently shadowed regions nearby.
 */
final class ReferenceStore
{
    public function __construct(private string $dir)
    {
    }

    public function raw(string $siteId): ?array
    {
        if (!preg_match('/^[a-z0-9_]{1,64}$/', $siteId)) {
            return null;
        }
        $f = $this->dir . '/' . $siteId . '.json';
        if (!is_file($f)) {
            return null;
        }
        $a = json_decode((string) file_get_contents($f), true);
        if (!is_array($a)) {
            throw new \RuntimeException('Reference data for this site could not be read. Please try again.');
        }
        return $a;
    }

    /** The block exposed as metrics.reference_long_term. */
    public function longTerm(array $site): array
    {
        if (($site['id'] ?? 'custom') === 'custom') {
            return ['available' => false, 'reason' => 'Custom coordinates: the long-term reference is prepared for catalogue sites only.'];
        }
        $r = $this->raw($site['id']);
        if ($r === null || empty($r['available'])) {
            return ['available' => false, 'reason' => $r['reason'] ?? 'Outside the PGDA south polar products (65°S–90°S).'];
        }
        $span = static fn(array $s) => [$s['p10'], $s['p90']];
        return [
            'available' => true,
            'sun_avg' => $r['sun']['at_site'],
            'earth_avg' => $r['earth']['at_site'],
            'sun_median_300m' => $r['sun']['within_300m']['median'],
            'earth_median_300m' => $r['earth']['within_300m']['median'],
            'sun_p10_p90_300m' => $span($r['sun']['within_300m']),
            'earth_p10_p90_300m' => $span($r['earth']['within_300m']),
            'psr_at_site' => $r['psr']['at_site'],
            'psr_fraction_300m' => $r['psr']['fraction_300m'],
            'psr_fraction_1km' => $r['psr']['fraction_1km'],
            'source' => $r['product']['name'],
            'version' => $r['product']['version'],
            'resolution_m' => $r['product']['resolution_m'],
            'period' => $r['product']['period'],
            'criterion' => 'any fraction of the disc visible (first limb), as defined in the PGDA labels',
            'citation' => $r['product']['citation'],
            'url' => $r['product']['page'],
        ];
    }
}
