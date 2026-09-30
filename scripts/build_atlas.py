"""Build a self-contained illustrated atlas from saved GIS snapshots.

Ground geometry uses a north-up local equirectangular projection with latitude
correction and equal ground scale on both axes. Building footprints are flat.
Interactive anchors use exactly the same projection as the ground map.
"""
from pathlib import Path
import json
import math
from html import escape
import regional_config as regional_config

ROOT = Path(__file__).resolve().parents[1]
W, H = 3400, 3400
LON, LAT = -122.3385, 47.609
SCALE = .48

def read(name):
    return json.loads((ROOT / 'data' / name).read_text())

def project(p):
    x = (p[0] - LON) * 111320 * math.cos(math.radians(LAT)) * SCALE
    y = (LAT - p[1]) * 111320 * SCALE
    return (W/2 + x, H/2 + y)

def simplify(points, tolerance=.25):
    """Drop subpixel vertex noise (at most ~0.52 m on the ground)."""
    if len(points)<3: return points
    a,b=points[0],points[-1]
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=dx*dx+dy*dy
    def distance(p):
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
        return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
    i=max(range(1,len(points)-1),key=lambda i:distance(points[i]))
    if distance(points[i])<=tolerance:return [a,b]
    return simplify(points[:i+1],tolerance)[:-1]+simplify(points[i:],tolerance)

def path(points, close=False):
    points=simplify(points)
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x,y in points) + ('Z' if close else '')

def line(g):
    if not g: return []
    return [g['coordinates']] if g['type']=='LineString' else g['coordinates'] if g['type']=='MultiLineString' else []

def polygons(g):
    if not g: return []
    return [g['coordinates']] if g['type']=='Polygon' else g['coordinates'] if g['type']=='MultiPolygon' else []

def geo_path(points):
    return path([project(p) for p in points])

def clipped_ring(coordinates):
    """Clip closed water polygons to the atlas; retain holes via even-odd fill."""
    points=[project(p) for p in coordinates]
    for axis,bound,greater in [(0,0,True),(0,W,False),(1,0,True),(1,H,False)]:
        if not points: break
        output=[]
        previous=points[-1]
        inside=lambda p: p[axis]>=bound if greater else p[axis]<=bound
        for current in points:
            if inside(current)!=inside(previous):
                t=(bound-previous[axis])/(current[axis]-previous[axis])
                output.append(tuple(previous[i]+t*(current[i]-previous[i]) for i in range(2)))
            if inside(current): output.append(current)
            previous=current
        points=output
    return points if len(points)>=3 else []

parts=[f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
<title>Seattle illustrated geographic atlas</title>
<desc>Seattle streets, shoreline, parks and 2015 building outlines. North-up plan view with flat building footprints. Map anchors use geocoded coordinates.</desc>
<defs>
<pattern id="waves" width="96" height="40" patternUnits="userSpaceOnUse"><path d="M8 20h42m9 0h21" stroke="#d4dfbd" stroke-width="1" opacity=".16"/></pattern>
</defs>
<rect width="{W}" height="{H}" fill="#e3cd99"/>
''']
# Closed hydrography polygons preserve the bay, islands and connected lakes.
# Unlike joining a short shoreline to a rectangle, this remains valid when panned.
for feature in read('washington-major-shorelines.geojson')['features']:
    for polygon in polygons(feature['geometry']):
        rings=[clipped_ring(ring) for ring in polygon]
        d=' '.join(path(ring,True) for ring in rings if len(ring)>=3)
        if d:
            parts.append(f'<path d="{d}" fill="#639b99" fill-rule="evenodd"/>')
            parts.append(f'<path d="{d}" fill="url(#waves)" fill-rule="evenodd"/>')
            # Stroke original rings so the clipping rectangle never looks like coast.
            coast=' '.join(geo_path(ring)+' Z' for ring,clip in zip(polygon,rings) if clip)
            parts.append(f'<path d="{coast}" fill="none" stroke="#f8e9bb" stroke-width="5"/>')
# Retain Seattle's finer waterfront survey around the event piers. This local
# land patch stays south of Lake Union and north of the Duwamish waterways.
segments=sorted([segment for feature in read('seattle-shoreline.geojson')['features']
    for segment in line(feature['geometry'])],key=lambda segment:segment[0][1],reverse=True)
coast=[point for segment in segments for point in segment]
local_land=coast+[[-122.31,coast[-1][1]],[-122.31,coast[0][1]]]
parts.append(f'<path d="{geo_path(local_land)} Z" fill="#e3cd99"/>')
parts.append(f'<path d="{geo_path(coast)}" fill="none" stroke="#f8e9bb" stroke-width="5"/>')
for f in read('atlas-parks.geojson')['features']:
    for poly in polygons(f['geometry']):
        d=' '.join(geo_path(r)+' Z' for r in poly)
        parts.append(f'<path d="{d}" fill="#8c9c70" stroke="#7c8e66" stroke-width="1" fill-rule="evenodd"/>')
road_groups={'local':[],'major':[],'freeway':[]}
for f in read('atlas-streets.geojson')['features']:
    designation=f['properties'].get('ARTDESCRIPT') or ''
    k='freeway' if 'Freeway' in designation else 'major' if 'Arterial' in designation else 'local'
    road_groups[k].extend(geo_path(s) for s in line(f['geometry']))
for k,width in [('local',4),('major',6),('freeway',9)]:
    d=' '.join(road_groups[k])
    parts.append(f'<path d="{d}" fill="none" stroke="#b5a77d" stroke-width="{width+2}" stroke-linejoin="round"/>')
    parts.append(f'<path d="{d}" fill="none" stroke="#f5e5bf" stroke-width="{width}" stroke-linejoin="round"/>')

buildings=[]
for f in read('atlas-buildings.geojson')['features']:
    for poly in polygons(f['geometry']):
        rings=[[project(p) for p in r] for r in poly]
        ring=rings[0]
        area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:])))/2
        if area<20: continue
        x=sum(p[0] for p in ring)/len(ring); y=sum(p[1] for p in ring)/len(ring)
        if not -100<x<W+100 or not -100<y<H+100: continue
        buildings.append((y, f['properties']['OBJECTID'], rings, area))
for y,key,rings,area in sorted(buildings):
    # Flat roof outlines stay at their original projected ground coordinates.
    roof=['#bd9c63','#c6ae7c','#d1bc8d','#bb835d','#819681'][key%5]
    d=' '.join(path(r,True) for r in rings)
    parts.append(f'<path d="{d}" fill="{roof}" stroke="#7e795d" stroke-width=".8" fill-rule="evenodd"/>')

# Lettering is intentionally sparse, preserving legibility of the event anchors.
labels=[('ELLIOTT BAY',-122.351,47.602,24,'#e5e7c7',6),('DOWNTOWN',-122.331,47.6095,19,'#294952',4),('PIONEER SQUARE',-122.329,47.5973,19,'#294952',3),('WATERFRONT',-122.3448,47.6082,13,'#294952',3),('SEATTLE CENTER',-122.350,47.622,19,'#294952',3),('BELLTOWN',-122.345,47.6155,19,'#294952',3),('CAPITOL HILL',-122.318,47.626,19,'#294952',3),('LAKE UNION',-122.337,47.636,22,'#e5e7c7',5),('SODO',-122.326,47.586,19,'#294952',4)]
for title,lon,lat,size,color,tracking in labels:
    x,y=project([lon,lat]); parts.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" font-family="Georgia,serif" font-size="{size}" font-weight="bold" letter-spacing="{tracking}" fill="{color}" stroke="#e3cd99" stroke-width="3" paint-order="stroke" stroke-opacity="{0 if title in ("ELLIOTT BAY","LAKE UNION") else .8}">{escape(title)}</text>')
# Small ferry vignette in open water: decoration, never a route or boarding point.
x,y=project([-122.35,47.6003])
parts.append(f'''<g transform="translate({x:.1f} {y:.1f}) rotate(-10)" aria-hidden="true"><path d="M-96 23h152m-132 9H15m-73 8h54" stroke="#d5dfbe" stroke-width="2" opacity=".55"/><path d="M-68 0H71L54 19H-49Z" fill="#213e49"/><path d="M-56-22H53V0H-56Z" fill="#f5e5b6"/><path d="M-38-37H34v15h-72z" fill="#f5e5b6"/><path d="M-41-40H37" stroke="#274b50" stroke-width="5"/><path d="M-13-53v13m14-8v8" stroke="#274b50" stroke-width="3"/><path d="M-47-13H43M-29-30H24" stroke="#507d7c" stroke-width="6" stroke-dasharray="8 4"/><path d="M-59 3H61" stroke="#b58e49" stroke-width="3"/></g>''')
parts.append('</svg>')
(ROOT/'assets/seattle-atlas.svg').write_text('\n'.join(parts))
events=read('event-locations.json'); hotels=read('hotel-locations.json')
locations={'cruise':events['pier55'],'venue':events['axis'],**hotels}
manifest={'width':W,'height':H,'overviewWidth':1600,'overviewHeight':1300,'rotation':0,'verticalCompression':1,'pixelsPerMeter':SCALE,'places':{}}
for key,loc in locations.items():
    x,y=project([loc['longitude'],loc['latitude']]); manifest['places'][key]={'x':round(x,4),'y':round(y,4),'longitude':loc['longitude'],'latitude':loc['latitude']}
# Airport anchor follows the saved airport-road route origin; downtown is AXIS.
regional_locations={'airport':read('sea-to-axis-uber-route.json')['geometry']['coordinates'][0],
                    'arrival':[events['axis']['longitude'],events['axis']['latitude']]}
manifest['regional']={'width':regional_config.WIDTH,'height':regional_config.HEIGHT,
    'overviewWidth':regional_config.OVERVIEW_WIDTH,'overviewHeight':regional_config.OVERVIEW_HEIGHT,
    'center':{'x':regional_config.WIDTH/2,'y':regional_config.HEIGHT/2}}
manifest['regionalPlaces']={key:{'x':round(regional_config.project((lon,lat))[0],4),
    'y':round(regional_config.project((lon,lat))[1],4),'longitude':lon,'latitude':lat}
    for key,(lon,lat) in regional_locations.items()}
(ROOT/'data/atlas-layout.json').write_text(json.dumps(manifest,indent=2)+'\n')
regional=(ROOT/'assets/seattle-region.svg').read_text()
for old,new in {'#e6e5d7':'#e3cd99','#b6cfca':'#639b99','#cdc7b6':'#b5a77d','#fffaf0':'#f5e5bf','#617d70':'#a45e42','#547065':'#294952'}.items(): regional=regional.replace(old,new)
(ROOT/'assets/seattle-atlas-region.svg').write_text(regional)
print(f'Built atlas: {len(buildings)} building polygons; {len(locations)} exact place anchors.')
