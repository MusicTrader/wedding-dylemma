"""Build the SEA-to-Seattle guide map from saved GIS and routing snapshots.

The regional map uses King County road centerlines and Sound Transit Link data.
Route overlays use a saved OSRM road routing snapshot; they are illustrative
and should be checked again before publication.
"""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
from regional_config import WIDTH, HEIGHT, WEST, SOUTH, EAST, NORTH, project


def read(name):
    return json.loads((ROOT / "data" / name).read_text())


def distance_to_line(point, start, end):
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = dx * dx + dy * dy
    if not length:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / length))
    return math.hypot(px - x1 - t * dx, py - y1 - t * dy)


def simplify(points, tolerance=0.55):
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    farthest = max(range(1, len(points) - 1),
                   key=lambda i: distance_to_line(points[i], first, last))
    if distance_to_line(points[farthest], first, last) <= tolerance:
        return [first, last]
    return simplify(points[:farthest + 1], tolerance)[:-1] + simplify(points[farthest:], tolerance)


def path(points, tolerance=0.55):
    points = simplify([project(point) for point in points], tolerance)
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in points) if points else ""


def lines(geometry):
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiLineString":
        return geometry["coordinates"]
    return []


def clipped_ring(coordinates):
    """Clip a shoreline polygon ring to the SVG viewport."""
    points = [project(point) for point in coordinates]
    edges = ((lambda p: p[0] >= 0, lambda a, b: (0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= WIDTH, lambda a, b: (WIDTH, a[1] + (b[1] - a[1]) * (WIDTH - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= 0, lambda a, b: (a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0)),
             (lambda p: p[1] <= HEIGHT, lambda a, b: (a[0] + (b[0] - a[0]) * (HEIGHT - a[1]) / (b[1] - a[1]), HEIGHT)))
    for inside, intersect in edges:
        if not points:
            break
        output = []
        previous = points[-1]
        for current in points:
            if inside(current):
                if not inside(previous):
                    output.append(intersect(previous, current))
                output.append(current)
            elif inside(previous):
                output.append(intersect(previous, current))
            previous = current
        points = output
    if len(points) < 3:
        return ""
    points = simplify(points, 0.7)
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in points) + " Z"


roads = read("atlas-regional-roads.geojson")["features"]
link = read("sound-transit-link.geojson")["features"]
stations = read("sound-transit-stations.geojson")["features"]
shorelines = read("atlas-regional-water.geojson")["features"]

road_paths = {"Primary": [], "Secondary": [], "Ramp": []}
for feature in roads:
    category = feature["properties"].get("RoadClass")
    if category in road_paths:
        road_paths[category].extend(path(line) for line in lines(feature["geometry"]))

rail_paths = []
route_rail_paths = []
for feature in link:
    if feature["properties"].get("DESCRIPTION") == "OMF":
        continue
    for line in lines(feature["geometry"]):
        rail_paths.append(path(line))
        if any(47.445 <= point[1] <= 47.6028 for point in line):
            route_rail_paths.append(path(line))

base = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Regional Seattle map from King County road and Sound Transit rail GIS data">
<title>Seattle and SEA Airport</title>
<metadata>King County NG9-1-1 road centerlines and Sound Transit Link alignment and stations. Snapshot September 2026. EPSG:4326 projected at approximately equal ground scale.</metadata>
<defs>
  <pattern id="paper" width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#64796e" opacity=".13"/></pattern>
</defs>
<rect width="{WIDTH}" height="{HEIGHT}" fill="#e6e5d7"/><rect width="{WIDTH}" height="{HEIGHT}" fill="url(#paper)"/>
''']

for feature in shorelines:
    geometry = feature["geometry"]
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        rings = " ".join(filter(None, (clipped_ring(ring) for ring in polygon)))
        if rings:
            base.append(f'<path d="{rings}" fill="#b6cfca" fill-rule="evenodd"/>')

for category, casing, center in (("Secondary", 3.3, 2.1), ("Primary", 6, 3.9), ("Ramp", 2.8, 1.7)):
    joined = " ".join(filter(None, road_paths[category]))
    base.append(f'<path d="{joined}" fill="none" stroke="#cdc7b6" stroke-width="{casing}" stroke-linecap="round" stroke-linejoin="round"/>')
    base.append(f'<path d="{joined}" fill="none" stroke="#fffaf0" stroke-width="{center}" stroke-linecap="round" stroke-linejoin="round"/>')

base.append(f'<path d="{" ".join(filter(None, rail_paths))}" fill="none" stroke="#617d70" stroke-width="2.8" stroke-linecap="round" opacity=".72"/>')
for station in stations:
    lon, lat = station["geometry"]["coordinates"][:2]
    if SOUTH <= lat <= NORTH and WEST <= lon <= EAST:
        x, y = project((lon, lat))
        base.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.1" fill="#fff8e9" stroke="#4c6d5e" stroke-width="1.5"/>')

base.append('<g font-family="Arial,sans-serif" font-weight="700" letter-spacing="2.4" fill="#547065">')
for name,lon,lat in [
    ('PUGET SOUND',-122.46,47.57),('SEATTLE',-122.305,47.612),
    ('SEATAC',-122.278,47.444),('WEST SEATTLE',-122.39,47.566),
    ('BURIEN',-122.365,47.47),('RENTON',-122.208,47.48),
    ('BELLEVUE',-122.185,47.609),('VASHON ISLAND',-122.475,47.416),
    ('BAINBRIDGE ISLAND',-122.53,47.655),('SHORELINE',-122.34,47.75)
]:
    x,y=project((lon,lat))
    base.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" font-size="11" opacity=".75">{name}</text>')
base.extend(['</g>', '</svg>'])
(ROOT / "assets" / "seattle-region.svg").write_text("\n".join(base))


def overlay(name, paths, color):
    markup = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" aria-hidden="true">
<defs><filter id="glow"><feGaussianBlur stdDeviation="5"/></filter></defs>
<path d="{' '.join(paths)}" fill="none" stroke="{color}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" opacity=".4" filter="url(#glow)"/>
<path d="{' '.join(paths)}" fill="none" stroke="#fff9ec" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
<path d="{' '.join(paths)}" fill="none" stroke="{color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    (ROOT / "assets" / f"route-{name}.svg").write_text(markup)


overlay("train", route_rail_paths, "#3d7b6b")
for name, color in (("uber", "#bb765d"), ("rental", "#a38351")):
    data = read("sea-to-axis-uber-route.json" if name == "uber" else "rental-to-axis-route.json")
    overlay(name, [path(data["geometry"]["coordinates"], tolerance=0.8)], color)

print(f"Built regional map from {len(roads)} King County road segments and {len(link)} Sound Transit rail segments")
