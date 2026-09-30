"""Render the local City of Seattle GIS snapshots as a styled downtown SVG.

Run from the project root: python3 scripts/build_map.py
The GeoJSON files in data/ are snapshots of Seattle's public ArcGIS layers.
"""

from __future__ import annotations

import json
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1200, 950
WEST, SOUTH, EAST, NORTH = -122.360, 47.591, -122.317, 47.614


def project(point: list[float]) -> tuple[float, float]:
    longitude, latitude = point[:2]
    return ((longitude - WEST) / (EAST - WEST) * WIDTH,
            (NORTH - latitude) / (NORTH - SOUTH) * HEIGHT)


def distance_to_segment(point, start, end):
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5


def simplify(points, tolerance=0.35):
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    farthest = max(range(1, len(points) - 1),
                   key=lambda i: distance_to_segment(points[i], first, last))
    if distance_to_segment(points[farthest], first, last) <= tolerance:
        return [first, last]
    return simplify(points[:farthest + 1], tolerance)[:-1] + simplify(points[farthest:], tolerance)


def line_path(points, close=False):
    points = simplify([project(point) for point in points])
    if not points:
        return ""
    path = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in points)
    return path + (" Z" if close else "")


def read(name):
    return json.loads((ROOT / "data" / name).read_text())["features"]


def geometry_lines(geometry):
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiLineString":
        return geometry["coordinates"]
    return []


def geometry_rings(geometry):
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    if geometry["type"] == "MultiPolygon":
        return [ring for polygon in geometry["coordinates"] for ring in polygon]
    return []


roads = read("seattle-streets.geojson")
shoreline = read("seattle-shoreline.geojson")
parks = read("seattle-parks.geojson")
landmarks = read("seattle-landmarks.geojson")
event_locations = json.loads((ROOT / "data" / "event-locations.json").read_text())

# The shoreline segments returned for this viewport follow Elliott Bay north to south.
shoreline_segments = sorted(
    [segment for feature in shoreline for segment in geometry_lines(feature["geometry"])],
    key=lambda segment: segment[0][1], reverse=True,
)
coast = [point for segment in shoreline_segments for point in segment]
coast_path = line_path(coast)
water_path = f"M0 0 L{project(coast[0])[0]:.1f} {project(coast[0])[1]:.1f} " + coast_path[1:] + f" L0 {HEIGHT} Z"

parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Downtown Seattle map derived from city GIS street, shoreline, and park data">
<title>Downtown Seattle street map</title>
<metadata>Street centerlines: Seattle Department of Transportation Seattle Streets. Shoreline and parks: City of Seattle GIS. Snapshot September 2026. Coordinates in EPSG:4326, locally projected to this SVG.</metadata>
<defs>
  <pattern id="water" width="74" height="26" patternUnits="userSpaceOnUse"><path d="M0 19 Q18 12 37 19 T74 19" fill="none" stroke="#d4e4df" stroke-width="2" opacity=".32"/></pattern>
  <filter id="point-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="1" dy="3" stdDeviation="3" flood-color="#50645c" flood-opacity=".28"/></filter>
</defs>
<rect width="100%" height="100%" fill="#e8e5d5"/>
<path d="{water_path}" fill="#91b1ad"/>
<path d="{water_path}" fill="url(#water)"/>
''']

park_paths = [line_path(ring, close=True) for feature in parks for ring in geometry_rings(feature["geometry"])]
parts.append('<g fill="#c5d2b5" fill-rule="evenodd" stroke="#aebcaa" stroke-width=".8">')
parts.extend(f'<path d="{path}"/>' for path in park_paths if path)
parts.append('</g>')

road_groups = {"local": [], "minor": [], "major": [], "freeway": []}
for feature in roads:
    designation = feature["properties"].get("ARTDESCRIPT") or ""
    category = ("freeway" if "Freeway" in designation else
                "major" if "Principal" in designation else
                "minor" if "Arterial" in designation else "local")
    for line in geometry_lines(feature["geometry"]):
        path = line_path(line)
        if path:
            road_groups[category].append(path)

for category, casing, center in [
    ("local", 3.1, 1.9), ("minor", 5.1, 3.2),
    ("major", 7.2, 4.7), ("freeway", 10.0, 6.5),
]:
    paths = road_groups[category]
    joined = " ".join(paths)
    parts.append(f'<path d="{joined}" fill="none" stroke="#c9c3b4" stroke-width="{casing}" stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append(f'<path d="{joined}" fill="none" stroke="#fff9eb" stroke-width="{center}" stroke-linecap="round" stroke-linejoin="round"/>')

parts.append(f'<path d="{coast_path}" fill="none" stroke="#e7eee3" stroke-width="4" opacity=".8"/>')
parts.append('<text x="118" y="460" transform="rotate(-18 118 460)" class="water-label">ELLIOTT BAY</text>')

for landmark in landmarks:
    name = landmark["properties"].get("NAME", "")
    x, y = project(landmark["geometry"]["coordinates"])
    label = "PIER 55" if name == "Pier 55" else "SMITH TOWER"
    label_y = y - 19 if name == "Pier 55" else y + 30
    parts.append(f'<g filter="url(#point-shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="#b56f59" stroke="#fff9eb" stroke-width="3"/></g>')
    parts.append(f'<text x="{x:.1f}" y="{label_y:.1f}" text-anchor="middle" class="landmark-label">{escape(label)}</text>')

axis = event_locations["axis"]
x, y = project([axis["longitude"], axis["latitude"]])
parts.append(f'<g filter="url(#point-shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="#36594d" stroke="#fff9eb" stroke-width="3"/></g>')
parts.append(f'<text x="{x:.1f}" y="{y+31:.1f}" text-anchor="middle" class="landmark-label">AXIS</text>')

parts.append('''<style>
  .water-label{font:700 17px Arial,sans-serif;letter-spacing:5px;fill:#e8f0e8;opacity:.8}
  .landmark-label{font:700 12px Arial,sans-serif;letter-spacing:2px;fill:#57665d;paint-order:stroke;stroke:#e8e5d5;stroke-width:4px}
</style></svg>''')

output = ROOT / "assets" / "seattle-map.svg"
output.write_text("\n".join(parts))
print(f"Wrote {output} ({len(roads)} street features, {len(parks)} park features, {len(shoreline)} shoreline features)")
