import osmium, json, sys
from shapely.geometry import Polygon
W={365212294,1159907277,874795302,1012399700}; N={11800596709,1623893077,8143204857,31248510}
out={}
class H(osmium.SimpleHandler):
    def node(s,n):
        if n.id in N: out[f'node/{n.id}']=dict(lat=round(n.location.lat,6),lon=round(n.location.lon,6),name=n.tags.get('name'),name_en=n.tags.get('name:en'),place=n.tags.get('place'))
    def way(s,w):
        if w.id in W:
            pts=[(x.lon,x.lat) for x in w.nodes]; c=Polygon(pts).centroid
            out[f'way/{w.id}']=dict(lat=round(c.y,6),lon=round(c.x,6),centroide=True,name=w.tags.get('name'),name_en=w.tags.get('name:en'),place=w.tags.get('place') or w.tags.get('landuse'))
H().apply_file(sys.argv[1],locations=True,idx='flex_mem')
json.dump(out,open('lieux.json','w'),ensure_ascii=False,indent=1); print(json.dumps(out,ensure_ascii=False,indent=1))
