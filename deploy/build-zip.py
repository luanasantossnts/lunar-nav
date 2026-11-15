# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Builds deploy/lunarnav-deploy.zip for shared hosting (public_html = the zip's root).

    python3 -I deploy/build-zip.py            (after `npm run build` in frontend/)

Allow-lists only: what is not listed here is not in the zip. Contents:
  - frontend/dist/*                       → site root (index.html, assets/, icons, 404.html)
  - deploy/root.htaccess, assets.htaccess → .htaccess, assets/.htaccess
  - api/: index.php, .htaccess, config.example.php, src/, two maintenance scripts in bin/,
    and in data/: sites, DSN, glossary, SVS list, validation, PGDA reference, horizon masks,
    and the caches (Horizons ephemerides, derived results, SVS, Analyst answers, TTS audio).
Never included: config.php, dotfiles other than .htaccess, tests, the dev router, DEMs, the
validation-only 60 m mask, Python, and the cache records with client data (hourly-limit
records and their index) or usage counters.
Writes nothing inside the project except the zip itself (ignored by git).
"""
import json
import re
import stat
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'frontend' / 'dist'
API = ROOT / 'api'
OUT = ROOT / 'deploy' / 'lunarnav-deploy.zip'

API_FILES = ['index.php', '.htaccess', 'config.example.php',
             'bin/.htaccess', 'bin/privacy-cleanup.php', 'bin/usage.php',
             'data/.htaccess', 'data/sites.json', 'data/dsn.json', 'data/glossary.json',
             'data/svs.json', 'data/validation.json']
API_TREES = ['src', 'data/pgda', 'data/terrain']
NEVER = re.compile(r'(^|/)(config\.php|dev-router\.php|tests/|\.env|\.lunarnav-ip-salt|.*\.tmp$|\.DS_Store$)')

USAGE_FIELDS = {'claude_questions', 'claude_requests', 'analyst_cache_hits', 'claude_input_tokens',
                'claude_output_tokens', 'tts_requests', 'tts_chars', 'stt_requests', 'limit_hits'}


def cache_kind(path: Path) -> str:
    """What one app-cache file holds, from its structure (the key itself is only a hash)."""
    try:
        d = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return 'unreadable'
    if not isinstance(d, dict):
        return 'other'
    k = set(d)
    if k == {'fetched_at', 'rows'}:
        return 'horizons'
    if k == {'data', 'fetched'}:
        return 'svs'
    if k == {'response', 'stored_at'}:
        return 'analyst'
    if 'available' in k and k & {'sun', 'earth', 'both'}:
        return 'derived'
    if k == {'n', 'w'} or k == {'cleaned', 'windows'} or any(x.startswith('rate:') for x in k):
        return 'rate-limit (client data)'
    if k & USAGE_FIELDS:
        return 'usage counters'
    return 'other'


KEEP = {'horizons', 'svs', 'analyst', 'derived'}


def add(z: zipfile.ZipFile, src: Path, arc: str, counts: dict, group: str) -> None:
    if NEVER.search(arc):
        raise SystemExit(f'refusing to add {arc}')
    info = zipfile.ZipInfo(arc, date_time=time.localtime(src.stat().st_mtime)[:6])
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(info, src.read_bytes())
    counts[group] = counts.get(group, 0) + 1


def main() -> None:
    if not (DIST / 'index.html').is_file():
        sys.exit('frontend/dist is missing: run `npm run build` in frontend/ first.')
    counts, skipped = {}, {}
    OUT.unlink(missing_ok=True)
    with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(DIST.rglob('*')):
            if f.is_file() and not f.name.startswith('.'):
                add(z, f, f.relative_to(DIST).as_posix(), counts, 'site (frontend/dist)')
        add(z, ROOT / 'deploy' / 'root.htaccess', '.htaccess', counts, 'site (frontend/dist)')
        add(z, ROOT / 'deploy' / 'assets.htaccess', 'assets/.htaccess', counts, 'site (frontend/dist)')
        for rel in API_FILES:
            add(z, API / rel, f'api/{rel}', counts, 'api code and config example' if not rel.startswith('data/') else 'api/data')
        for tree in API_TREES:
            for f in sorted((API / tree).rglob('*')):
                if f.is_file() and (not f.name.startswith('.') or f.name == '.htaccess'):
                    add(z, f, f'api/{f.relative_to(API).as_posix()}', counts, 'api code and config example' if tree == 'src' else f'api/{tree}')
        cache = API / 'data' / 'cache'
        for f in sorted(cache.glob('*/*.json')):
            kind = cache_kind(f)
            if kind in KEEP:
                add(z, f, f'api/data/cache/{f.relative_to(cache).as_posix()}', counts, f'api/data/cache · {kind}')
            else:
                skipped[kind] = skipped.get(kind, 0) + 1
        for f in sorted((cache / 'tts').rglob('*.mp3')):
            add(z, f, f'api/data/cache/{f.relative_to(cache).as_posix()}', counts, 'api/data/cache · tts audio')

    size = OUT.stat().st_size
    print(f'Wrote {OUT.relative_to(ROOT)} — {size / 1e6:.1f} MB ({size} bytes)')
    for g, n in sorted(counts.items()):
        print(f'  {n:5d}  {g}')
    print('Left out of the cache:', ', '.join(f'{n} {k}' for k, n in sorted(skipped.items())) or 'nothing')


if __name__ == '__main__':
    main()
