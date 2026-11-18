"""Download a cover for every book in _data/reading.yml that doesn't have one yet.

Covers come from Open Library and land in photos/books/<slug>.jpg, where <slug> is the
title run through the same slugify that reading.html uses, so the page finds them with no
change to the YAML. A book with no cover file shows a plain title card instead.

    python3 scripts/fetch_covers.py                 # fetch every missing cover
    python3 scripts/fetch_covers.py --list          # show each book's slug and whether it has a cover
    python3 scripts/fetch_covers.py --cover "Lolita" 12984540   # replace one cover by Open Library cover id

To find a better cover id, open the book's page on openlibrary.org, pick an edition, and copy
the number from its cover image URL (covers.openlibrary.org/b/id/<number>-L.jpg).
"""
import argparse
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / '_data' / 'reading.yml'
COVERS = ROOT / 'photos' / 'books'
HEIGHT = 480  # pixels; the shelf shows covers at up to 210px tall, so this is sharp at 2x
UA = {'User-Agent': 'sonnetx.github.io cover fetcher (sonnet@stanford.edu)'}


def slugify(title):
    """Jekyll's default slugify: runs of anything but letters, marks and digits become one
    hyphen, hyphens at either end go, and the result is lowercased."""
    keep = lambda c: unicodedata.category(c)[0] in 'LM' or unicodedata.category(c) == 'Nd'
    out, gap = [], False
    for c in title:
        if keep(c):
            out.append(c)
            gap = False
        elif not gap:
            out.append('-')
            gap = True
    return ''.join(out).strip('-').lower()


def books():
    data = yaml.safe_load(DATA.read_text())
    for shelf, items in data.items():
        for b in items or []:
            yield shelf, b


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def find_cover_id(title, author):
    q = urllib.parse.urlencode({'title': title, 'author': author, 'limit': 10,
                                'fields': 'title,author_name,cover_i,edition_count'})
    docs = json.loads(fetch('https://openlibrary.org/search.json?' + q))['docs']
    docs = [d for d in docs if d.get('cover_i')]
    if not docs:
        return None
    # Prefer an exact title match, then the work with the most editions.
    exact = [d for d in docs if d['title'].lower() == title.lower()]
    return max(exact or docs, key=lambda d: d.get('edition_count', 0))['cover_i']


def save_cover(cover_id, path):
    img = Image.open(io.BytesIO(fetch(f'https://covers.openlibrary.org/b/id/{cover_id}-L.jpg'))).convert('RGB')
    if img.height < 100:
        raise ValueError(f'cover {cover_id} is a placeholder ({img.width}x{img.height})')
    if img.height > HEIGHT:
        img = img.resize((round(img.width * HEIGHT / img.height), HEIGHT), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'JPEG', quality=85, optimize=True, progressive=True)
    return img.size


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--list', action='store_true', help='show slugs and which books lack a cover')
    ap.add_argument('--cover', nargs=2, metavar=('TITLE', 'COVER_ID'), help='replace one cover by Open Library cover id')
    args = ap.parse_args()

    if args.cover:
        title, cover_id = args.cover
        path = COVERS / f'{slugify(title)}.jpg'
        print(path.relative_to(ROOT), save_cover(int(cover_id), path))
        return

    missing = 0
    for shelf, b in books():
        path = COVERS / f'{slugify(b["title"])}.jpg'
        if args.list:
            print(f'{shelf:9} {"cover" if path.exists() else "MISSING":7} {path.relative_to(ROOT)}')
            continue
        if path.exists():
            continue
        cover_id = find_cover_id(b['title'], b.get('author', ''))
        if cover_id is None:
            print(f'no cover found: {b["title"]}', file=sys.stderr)
            missing += 1
            continue
        size = save_cover(cover_id, path)
        print(f'{path.relative_to(ROOT)}  cover {cover_id}  {size[0]}x{size[1]}')
    if missing:
        print(f'{missing} book(s) will show a title card. Use --cover to set one by hand.', file=sys.stderr)


if __name__ == '__main__':
    main()
