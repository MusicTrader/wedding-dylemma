"""Refresh the expanded atlas snapshots from public City of Seattle GIS.

Requires curl. Pages are ordered by object ID, checked against the service's
feature count, and saved only after a complete layer has been downloaded.
"""
from pathlib import Path
from datetime import datetime, timezone
import json
import math
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
W, H, SCALE = 3400, 3400, .48
LON, LAT = -122.3385, 47.609
DX = W/2/(111320*math.cos(math.radians(LAT))*SCALE)
DY = H/2/(111320*SCALE)
# Include a buffer beyond every rendered edge to avoid partially empty blocks.
BBOX = [LON-DX-.001, LAT-DY-.001, LON+DX+.001, LAT+DY+.001]
BASE = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/'
LAYERS = {
    'streets': ('Seattle_Streets_1/FeatureServer/0', 'STNAME_ORD,ARTDESCRIPT'),
    'parks': ('Park_Boundaries/FeatureServer/2', 'NAME'),
    'buildings': ('Building_Outline_2015/FeatureServer/0', 'OBJECTID,YEARUPDATED'),
}

def request(url, params):
    result = subprocess.run(['curl','--fail','--silent','--show-error','--retry','3',
        '--max-time','90',url+'?'+urllib.parse.urlencode(params)],check=True,capture_output=True)
    data=json.loads(result.stdout)
    if 'error' in data: raise RuntimeError(data['error'])
    return data

manifest={'downloadedAt':datetime.now(timezone.utc).isoformat(),'queryBounds':BBOX,'layers':{}}
for name,(endpoint,fields) in LAYERS.items():
    url=BASE+endpoint
    meta=request(url,{'f':'json'})
    oid=meta['objectIdField']
    common={'where':'1=1','geometry':','.join(map(str,BBOX)),
        'geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects'}
    count=request(url+'/query',{**common,'f':'json','returnCountOnly':'true'})['count']
    features=[]
    page_size=min(meta.get('maxRecordCount',2000),2000)
    while len(features)<count:
        page=request(url+'/query',{**common,'f':'geojson','outSR':4326,
            'outFields':fields if oid in fields.split(',') else oid+','+fields,
            'returnGeometry':'true','geometryPrecision':7,
            'orderByFields':oid,'resultOffset':len(features),'resultRecordCount':page_size})
        batch=page.get('features',[])
        if not batch: raise RuntimeError(f'{name}: incomplete pagination')
        features.extend(batch)
        print(f'{name}: {len(features)}/{count}',flush=True)
    assert len(features)==count and len({f['properties'][oid] for f in features})==count
    target=ROOT/'data'/f'atlas-{name}.geojson'
    target.write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
    manifest['layers'][name]={'url':url,'featureCount':count,'credits':meta.get('copyrightText','')}
(ROOT/'data/atlas-sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
