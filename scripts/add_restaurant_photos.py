#!/usr/bin/env python3
"""Add photos of a restaurant to the Restaurants page.

    python3 scripts/add_restaurant_photos.py "Zuni Cafe" ~/Downloads/IMG_1234.HEIC ~/Downloads/IMG_1240.jpg

Each photo becomes a JPEG in photos/restaurants/<slug>/ numbered after the ones already
there, at most 1400 pixels on its long side, turned upright, and stripped of EXIF data
(including GPS). The name should match the place's name in _data/restaurants.yml, or its
slug field if it has one. HEIC files go through macOS sips first.
"""

import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
LONG_SIDE = 1400


def slugify(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def open_image(src, tmp):
    if src.suffix.lower() in (".heic", ".heif"):
        out = Path(tmp) / (src.stem + ".jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", str(src), "--out", str(out)],
                       check=True, capture_output=True)
        src = out
    return Image.open(src)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    slug = slugify(sys.argv[1])
    folder = ROOT / "photos" / "restaurants" / slug
    folder.mkdir(parents=True, exist_ok=True)
    taken = [int(p.stem) for p in folder.glob("*.jpg") if p.stem.isdigit()]
    n = max(taken, default=0)
    with tempfile.TemporaryDirectory() as tmp:
        for arg in sys.argv[2:]:
            src = Path(arg).expanduser()
            img = ImageOps.exif_transpose(open_image(src, tmp)).convert("RGB")
            img.thumbnail((LONG_SIDE, LONG_SIDE), Image.LANCZOS)
            n += 1
            dst = folder / f"{n}.jpg"
            img.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
            print(f"{src.name} -> {dst.relative_to(ROOT)} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
