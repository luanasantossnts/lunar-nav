# AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
"""
Builds deploy/kids/kids-deploy.zip: the content of the kids.lunarnav.space folder.

    (cd kids && npm run build) && python3 -I deploy/kids/build-zip.py

Contents: kids/dist/* at the root, plus .htaccess (HTTPS, SPA fallback, strict CSP) and
assets/.htaccess (long cache). Nothing else: no source, tests, scripts, data export or keys.
The zip is not committed.
"""
import re
import stat
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'kids' / 'dist'
HERE = ROOT / 'deploy' / 'kids'
OUT = HERE / 'kids-deploy.zip'
NEVER = re.compile(r'(\.map$|(^|/)\.(?!htaccess$)|\.(md|py|php|sh|test\.js)$)')


def add(z, src, arc):
    if NEVER.search(arc):
        raise SystemExit(f'refusing to add {arc}')
    info = zipfile.ZipInfo(arc, date_time=time.localtime(src.stat().st_mtime)[:6])
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(info, src.read_bytes())


def main():
    if not (DIST / 'index.html').is_file():
        sys.exit('kids/dist is missing: run `npm run build` in kids/ first.')
    OUT.unlink(missing_ok=True)
    n = 0
    with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(DIST.rglob('*')):
            if f.is_file() and not f.name.startswith('.'):
                add(z, f, f.relative_to(DIST).as_posix()); n += 1
        add(z, HERE / 'kids.htaccess', '.htaccess')
        add(z, HERE / 'assets.htaccess', 'assets/.htaccess')
    print(f'Wrote {OUT.relative_to(ROOT)} — {OUT.stat().st_size / 1e3:.0f} kB, {n + 2} files')
    for name in zipfile.ZipFile(OUT).namelist():
        print('  ', name)


if __name__ == '__main__':
    main()
