"""Refresh coarse airport-map coverage; keep only arterial roads and water."""
from pathlib import Path
from datetime import datetime,timezone
import json
import subprocess
import urllib.parse
from regional_config import WEST,SOUTH,EAST,NORTH
ROOT=Path(__file__).resolve().parents[1]
LAYERS={
 'roads':('https://services.arcgis.com/Ej0PsM5Aw677QF1W/ArcGIS/rest/services/SiteAddressPoints_Distribution/FeatureServer/1',"RoadClass IN ('Primary','Secondary','Ramp')",'RoadClass'),
 'water':('https://data.wsdot.wa.gov/ArcGIS/rest/services/Shared/MajorShorelinesData/FeatureServer/0','1=1','OBJECTID')
}
def request(url,params):
    result=subprocess.run(['curl','-fsSL','--retry','3','--max-time','90',url+'?'+urllib.parse.urlencode(params)],check=True,capture_output=True)
    data=json.loads(result.stdout)
    if 'error' in data:raise RuntimeError(data['error'])
    return data
metadata={'downloadedAt':datetime.now(timezone.utc).isoformat(),'bounds':[WEST,SOUTH,EAST,NORTH],'layers':{}}
for name,(url,where,fields) in LAYERS.items():
    layer=request(url,{'f':'json'});oid=layer.get('objectIdField') or next(f['name'] for f in layer['fields'] if f['type']=='esriFieldTypeOID')
    common={'where':where,'geometry':','.join(map(str,[WEST,SOUTH,EAST,NORTH])),'geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects'}
    count=request(url+'/query',{**common,'f':'json','returnCountOnly':'true'})['count']
    features=[]
    while len(features)<count:
        batch=request(url+'/query',{**common,'f':'geojson','outSR':4326,'outFields':oid+','+fields,'returnGeometry':'true','geometryPrecision':6,'orderByFields':oid,'resultOffset':len(features),'resultRecordCount':min(2000,layer.get('maxRecordCount',2000))})['features']
        if not batch:raise RuntimeError('Incomplete page')
        features.extend(batch);print(f'{name}: {len(features)}/{count}',flush=True)
    assert len(features)==count and len({f['properties'][oid] for f in features})==count
    (ROOT/'data'/f'atlas-regional-{name}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
    metadata['layers'][name]={'url':url,'featureCount':count}
(ROOT/'data/atlas-regional-sources.json').write_text(json.dumps(metadata,indent=2)+'\n')
