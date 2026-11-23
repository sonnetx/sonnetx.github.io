#!/usr/bin/env python3
"""Merge Google Maps reviews and saved lists from a Google Takeout export into
_data/restaurants.yml.

    python3 scripts/import_maps_takeout.py ~/Downloads/takeout-20261123.zip
    python3 scripts/import_maps_takeout.py ~/Downloads/Takeout --geocode --near "California"

Export from takeout.google.com with "Maps (your places)" (reviews, with coordinates) and
"Saved" (lists such as Want to go, as CSV). Pass the zip or the unzipped folder.

Reviews become status been. Places on the Want to go list become status want, and
--want-list picks other lists. Saved lists carry no coordinates or address, so --geocode
looks those places up on OpenStreetMap (one request a second) and --near adds a region to
each lookup. Check what it finds, since a common name can land in the wrong city. A place
with coordinates but no address takes the area of the nearest place within 2 km, and
--geocode asks OpenStreetMap for the town of any place still without one.

Running the script again merges. Hand edits to area, cuisine, note, color, pinned and slug
survive, a want place that gains a review moves to been, and names or URLs under ignored
are skipped.
"""

import argparse
import csv
import datetime
import io
import json
import math
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "_data" / "restaurants.yml"
FIELDS = ["name", "status", "area", "cuisine", "pinned", "rating", "visited", "note",
          "lat", "lng", "url", "address", "color", "slug"]
HAND_FIELDS = {"area", "cuisine", "note", "color", "pinned", "slug", "visited"}


def slugify(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def read_export(path):
    """Yield (relative path, bytes) for every file in a Takeout zip or folder."""
    path = Path(path).expanduser()
    if path.is_file() and zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as zf:
            for info in zf.infolist():
                if not info.is_dir():
                    yield info.filename, zf.read(info)
    elif path.is_dir():
        for f in path.rglob("*"):
            if f.is_file():
                yield str(f.relative_to(path)), f.read_bytes()
    else:
        sys.exit(f"{path} is not a Takeout zip or folder")


def first(*values):
    for v in values:
        if v not in (None, "", [], {}):
            return v
    return None


def city_from_address(address):
    """Pull the city out of an address like '1 Main St, San Mateo, CA 94401, USA'."""
    if not address:
        return None
    parts = [p.strip() for p in address.split(",")]
    for i, part in enumerate(parts):
        if i > 0 and re.match(r"^[A-Z]{2}( \d{5}(-\d{4})?)?$", part):
            return parts[i - 1]
    if len(parts) >= 3:
        return parts[-3]
    return None


def coords_from_url(url):
    if not url:
        return None
    m = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", url) or re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    return (float(m.group(1)), float(m.group(2))) if m else None


def parse_reviews(raw):
    places = []
    for feature in json.loads(raw).get("features", []):
        props = feature.get("properties", {})
        loc = props.get("location") or props.get("Location") or {}
        name = first(loc.get("name"), loc.get("Business Name"), props.get("Title"))
        if not name:
            continue
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        geo = loc.get("Geo Coordinates") or {}
        lat = first(geo.get("Latitude"), coords[1] if len(coords) > 1 else None)
        lng = first(geo.get("Longitude"), coords[0] if coords else None)
        lat, lng = (float(lat), float(lng)) if lat and lng else (None, None)
        address = first(loc.get("address"), loc.get("Address"))
        date = first(props.get("date"), props.get("Published")) or ""
        rating = first(props.get("five_star_rating_published"), props.get("Star Rating"))
        places.append({
            "name": name.strip(),
            "status": "been",
            "area": city_from_address(address),
            "rating": int(rating) if rating else None,
            "visited": datetime.date.fromisoformat(date[:10]) if re.match(r"^\d{4}-\d{2}-\d{2}", date) else None,
            "note": first(props.get("review_text_published"), props.get("Review Comment")),
            "lat": round(lat, 6) if lat else None,
            "lng": round(lng, 6) if lng else None,
            "url": first(props.get("google_maps_url"), props.get("Google Maps URL")),
            "address": address,
        })
    return places


def parse_saved_list(raw):
    places = []
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        name = (row.get("Title") or "").strip()
        if not name:
            continue
        url = (row.get("URL") or "").strip() or None
        coords = coords_from_url(url)
        places.append({
            "name": name,
            "status": "want",
            "note": first((row.get("Note") or "").strip(), (row.get("Comment") or "").strip()),
            "lat": coords[0] if coords else None,
            "lng": coords[1] if coords else None,
            "url": url,
        })
    return places


def geocode(place, near):
    query = ", ".join(x for x in [place["name"], place.get("address"), near] if x)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1})
    req = urllib.request.Request(url, headers={"User-Agent": "restaurant-list-import/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        hits = json.load(resp)
    time.sleep(1.1)
    if not hits:
        return None
    hit = hits[0]
    addr = hit.get("address", {})
    city = first(addr.get("city"), addr.get("town"), addr.get("village"), addr.get("suburb"))
    return round(float(hit["lat"]), 6), round(float(hit["lon"]), 6), city, hit.get("display_name")


def reverse_geocode(lat, lng):
    url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
        {"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 14})
    req = urllib.request.Request(url, headers={"User-Agent": "restaurant-list-import/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        addr = json.load(resp).get("address", {})
    time.sleep(1.1)
    return first(addr.get("city"), addr.get("town"), addr.get("village"), addr.get("suburb"))


def km(a, b):
    dlat = (a["lat"] - b["lat"]) * 111.0
    dlng = (a["lng"] - b["lng"]) * 111.0 * math.cos(math.radians(a["lat"]))
    return math.hypot(dlat, dlng)


def borrow_areas(places, radius_km=2.0):
    """Give a place with coordinates but no area the area of the nearest place within reach."""
    known = [p for p in places if p.get("area") and p.get("lat") is not None]
    for p in places:
        if p.get("area") or p.get("lat") is None or not known:
            continue
        nearest = min(known, key=lambda q: km(p, q))
        if km(p, nearest) <= radius_km:
            p["area"] = nearest["area"]


def key(place):
    return (place.get("url") or "").split("&")[0] or place["name"].lower()


def merge(existing, incoming):
    """Fill gaps in an existing place from an import without undoing hand edits."""
    if incoming["status"] == "been":
        existing["status"] = "been"
    for field, value in incoming.items():
        if value is None or field == "status":
            continue
        if field in HAND_FIELDS and existing.get(field):
            continue
        if field == "rating" or not existing.get(field):
            existing[field] = value


def header(path):
    lines = []
    if path.exists():
        for line in path.read_text().splitlines():
            if line.startswith("#") or not line.strip():
                lines.append(line)
            else:
                break
    return "\n".join(lines).rstrip() + "\n\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("export", help="Takeout zip or unzipped folder")
    ap.add_argument("--want-list", action="append", default=None,
                    help='saved list to import as want (default "Want to go"); repeatable')
    ap.add_argument("--geocode", action="store_true", help="look up places that have no coordinates")
    ap.add_argument("--near", default=None, help='region added to each lookup, e.g. "California"')
    ap.add_argument("--out", default=str(DATA), help="YAML file to merge into")
    ap.add_argument("--dry-run", action="store_true", help="print what would change and write nothing")
    args = ap.parse_args()
    want_lists = {n.lower() for n in (args.want_list or ["Want to go"])}

    reviews, saved = [], []
    for name, raw in read_export(args.export):
        base = Path(name).name
        if base == "Reviews.json":
            reviews += parse_reviews(raw)
        elif base.lower().endswith(".csv") and Path(base).stem.lower() in want_lists:
            saved += parse_saved_list(raw)
    if not reviews and not saved:
        sys.exit("Found no Reviews.json and no saved list named " + ", ".join(sorted(want_lists)))

    out = Path(args.out)
    data = yaml.safe_load(out.read_text()) if out.exists() else None
    data = data or {}
    places = data.get("places") or []
    ignored = data.get("ignored") or []
    skip = {str(x).lower() for x in ignored}
    # A place added by hand usually has a share link rather than the URL Takeout uses, so
    # an import also matches on the name.
    by_key = {key(p): p for p in places}
    by_name = {p["name"].lower(): p for p in places}

    added, updated = [], []
    for place in reviews + saved:
        if place["name"].lower() in skip or (place.get("url") or "").lower() in skip:
            continue
        existing = by_key.get(key(place)) or by_name.get(place["name"].lower())
        if existing:
            before = dict(existing)
            merge(existing, place)
            if existing != before:
                updated.append(place["name"])
        else:
            entry = {f: place[f] for f in FIELDS if place.get(f) is not None}
            places.append(entry)
            by_key[key(place)] = entry
            by_name[place["name"].lower()] = entry
            added.append(place["name"])

    missing = [p for p in places if p.get("lat") is None]
    if args.geocode and missing and not args.dry_run:
        print(f"Looking up {len(missing)} places on OpenStreetMap")
        for p in missing:
            hit = geocode(p, args.near)
            if hit:
                p["lat"], p["lng"] = hit[0], hit[1]
                if not p.get("area") and hit[2]:
                    p["area"] = hit[2]
                print(f"  {p['name']}: {hit[3]}")
            else:
                print(f"  {p['name']}: not found")
        missing = [p for p in places if p.get("lat") is None]

    borrow_areas(places)
    if args.geocode and not args.dry_run:
        for p in places:
            if not p.get("area") and p.get("lat") is not None:
                p["area"] = reverse_geocode(p["lat"], p["lng"])
                print(f"  {p['name']} is in {p['area']}")

    # Been places newest first, then want places in list order, with fields in a fixed order.
    been = sorted([p for p in places if p.get("status") == "been"],
                  key=lambda p: str(p.get("visited") or ""), reverse=True)
    want = [p for p in places if p.get("status") != "been"]
    places = [{f: p[f] for f in FIELDS if p.get(f) is not None}
              | {k: v for k, v in p.items() if k not in FIELDS} for p in been + want]

    print(f"{len(reviews)} reviews and {len(saved)} saved places in the export")
    print(f"Added {len(added)}, updated {len(updated)}, {len(places)} places in all")
    for n in added:
        print(f"  + {n}")
    if missing:
        print(f"{len(missing)} {'place has' if len(missing) == 1 else 'places have'} no coordinates "
              "and will stay off the map until it gets lat and lng:")
        for p in missing:
            print(f"  ? {p['name']}")
    if args.dry_run:
        return

    body = yaml.safe_dump({"places": places, "ignored": ignored}, sort_keys=False,
                          allow_unicode=True, width=100)
    out.write_text(header(out) + body)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
