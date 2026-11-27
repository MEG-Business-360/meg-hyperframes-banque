import json, math
from shapely.geometry import LineString, Polygon, box, Point, MultiLineString
from shapely.ops import linemerge, polygonize, unary_union
d=json.load(open('osm-dubai.json'))
LAT0,LAT1=25.02,25.33
LON0=55.25-(1360/660)*(LAT1-LAT0)/math.cos(math.radians((LAT0+LAT1)/2))/2; LON1=55.25+(55.25-LON0)
W,H=1360,660
K=math.cos(math.radians((LAT0+LAT1)/2))
# verifie le rapport : largeur km / hauteur km
print('rapport km', (LON1-LON0)*K/(LAT1-LAT0), 'cible', W/H)
def xy(lo,la): return ((lo-LON0)/(LON1-LON0)*W, (LAT1-la)/(LAT1-LAT0)*H)
cadre=box(LON0-0.05,LAT0-0.05,LON1+0.05,LAT1+0.05)
lines=linemerge([LineString(c['pts']) for c in d['coast']])
lines=list(lines.geoms) if hasattr(lines,'geoms') else [lines]
closed=[l for l in lines if l.is_ring]; ouverts=[l for l in lines if not l.is_ring]
print('anneaux',len(closed),'ouverts',len(ouverts))
# continent : decoupe du cadre par les lignes ouvertes, garde les morceaux qui contiennent un point terrestre connu
coupe=unary_union([cadre.exterior]+[l.intersection(cadre) for l in ouverts])
morceaux=list(polygonize(coupe))
terre_pts=[Point(55.3803,25.0925),Point(55.2080,25.0566)]
cont=[p for p in morceaux if any(p.contains(t) for t in terre_pts)]
# controle par orientation OSM : terre a gauche de la ligne
print('morceaux',len(morceaux),'continent',len(cont), [round(p.area,4) for p in morceaux][:10])
from shapely.geometry import LinearRing
iles=[Polygon(l) for l in closed if Polygon(l).intersects(cadre) and LinearRing(l.coords).is_ccw]
lacs=[Polygon(l) for l in closed if Polygon(l).intersects(cadre) and not LinearRing(l.coords).is_ccw]
print('iles',len(iles),'eau fermee',len(lacs),[round(p.area*1e6) for p in lacs][:8])
terre=unary_union(cont+iles).difference(unary_union(lacs) if lacs else Polygon()).intersection(box(LON0-0.03,LAT0-0.03,LON1+0.03,LAT1+0.03))
def chemin(g,tol):
    out=[]
    gs=g.geoms if hasattr(g,'geoms') else [g]
    for p in gs:
        if p.is_empty: continue
        rings=[p.exterior,*p.interiors] if p.geom_type=='Polygon' else [p]
        for r in rings:
            pts=[xy(*c) for c in r.coords]
            s=LineString(pts).simplify(tol)
            c=list(s.coords)
            if len(c)<3 and p.geom_type=='Polygon': continue
            out.append('M'+' '.join(f'{x:.1f} {y:.1f}' for x,y in c)+('Z' if p.geom_type=='Polygon' else ''))
    return ''.join(out)
terre_d=chemin(terre,0.9)
roads=[LineString(r['pts']) for r in d['roads'] if r['hw']=='motorway']
routes=unary_union(roads).intersection(box(LON0,LAT0,LON1,LAT1))
routes=linemerge(routes) if routes.geom_type=='MultiLineString' else routes
routes_d=chemin(routes,1.2)
json.dump(dict(cadre=dict(lon0=LON0,lon1=LON1,lat0=LAT0,lat1=LAT1,w=W,h=H,projection='equirectangulaire, x mis a l echelle par cos(latitude moyenne)'),
  terre=terre_d,routes=routes_d,anneaux=len(closed)),open('carte-svg.json','w'))
print('octets terre',len(terre_d),'routes',len(routes_d))
open('apercu.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#0b2a1e"/><path d="{terre_d}" fill="#1d5a40" fill-rule="evenodd" stroke="#F0CC86" stroke-width="1"/><path d="{routes_d}" fill="none" stroke="#E8B65C" stroke-opacity=".5" stroke-width="1.5"/></svg>')
