"""Refresh the homepage's pinned, attributed Datacenter Map snapshot.

Run with Python 3. Pass --revision with a reviewed upstream commit to update it.
Prices are EIA 2024 industrial averages; policy labels are provisional.
Geometry derives from public-domain US Census boundaries via US Atlas.
State data: Sonnet Xu, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
"""
import argparse
import datetime
import json
import math
import pathlib
import statistics
import urllib.request

REVISION = '1ab2c73ab0db46cb8cdd201179a08cf05fae09df'
ROOT = pathlib.Path(__file__).resolve().parent


def simplify(points, tolerance=0.65):
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = dx * dx + dy * dy
    distances = []
    for x, y in points[1:-1]:
        t = max(0, min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / length)) if length else 0
        distances.append(math.hypot(x - start[0] - t * dx, y - start[1] - t * dy))
    farthest = max(distances)
    if farthest <= tolerance:
        return [start, end]
    index = distances.index(farthest) + 1
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def geometry_paths(topology):
    scale = topology['transform']['scale']
    translate = topology['transform']['translate']
    arcs = []
    for arc in topology['arcs']:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(simplify(points))
    paths = {}
    for shape in topology['objects']['states']['geometries']:
        polygons = [shape['arcs']] if shape['type'] == 'Polygon' else shape['arcs']
        parts = []
        for polygon in polygons:
            for ring in polygon:
                points = []
                for index in ring:
                    segment = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
                    points.extend(segment if not points else segment[1:])
                parts.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in points) + 'Z')
        paths[shape['properties']['name']] = ''.join(parts)
    return paths


def color(price, low, high):
    start, end = (219, 226, 211), (53, 84, 67)
    amount = (price - low) / (high - low)
    return '#' + ''.join(f'{round(a + (b - a) * amount):02x}' for a, b in zip(start, end))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', default=REVISION)
    args = parser.parse_args()
    if len(args.revision) != 40 or any(c not in '0123456789abcdef' for c in args.revision):
        parser.error('--revision must be a full lowercase commit SHA')

    def fetch(path):
        url = f'https://raw.githubusercontent.com/sonnetx/datacenter-map/{args.revision}/{path}'
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.load(response)

    records = fetch('data/states.json')
    paths = geometry_paths(fetch('src/states-albers-10m.json'))
    assert len(records) == len({state['a'] for state in records}) == 50
    assert all(state['rr']['pb'] in ('Low', 'Moderate', 'High') for state in records)
    low, high = min(s['p'] for s in records), max(s['p'] for s in records)
    states = [{
        'a': s['a'], 'n': s['n'], 'p': s['p'], 'posture': s['st'],
        'pushback': s['rr']['pb'], 'color': color(s['p'], low, high), 'path': paths[s['n']],
    } for s in sorted(records, key=lambda item: item['n'])]
    data = {
        'source_revision': args.revision,
        'retrieved': datetime.date.today().isoformat(),
        'attribution': 'Sonnet Xu / Datacenter Map, CC BY 4.0; geometry US Atlas / US Census (public domain)',
        'price_year': 2024,
        'median': round(statistics.median(s['p'] for s in states), 2),
        'default': next(s for s in states if s['a'] == 'VA'),
        'states': states,
    }
    # The default record needs no duplicate map geometry.
    data['default'] = {k: v for k, v in data['default'].items() if k not in ('path', 'color')}
    output = ROOT / '_data' / 'compute_preview.json'
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(states)} states to {output}')


if __name__ == '__main__':
    main()
