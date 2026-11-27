import osmium, json, sys, re
BB=(54.80,24.88,55.65,25.40)
inb=lambda lo,la: BB[0]<=lo<=BB[2] and BB[1]<=la<=BB[3]
pat=re.compile(r'(residence complex|weston|dlrc|majan|meydan|jumeirah village circle)',re.I)
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.coast=[]; s.roads=[]; s.hits=[]
    def node(s,n):
        if n.tags and inb(n.location.lon,n.location.lat):
            nm=' '.join(n.tags.get(k,'') for k in ('name','name:en'))
            if pat.search(nm) or n.tags.get('place') in ('city','suburb','neighbourhood','quarter'):
                s.hits.append(dict(t='node',id=n.id,lat=n.location.lat,lon=n.location.lon,tags=dict(n.tags)))
    def way(s,w):
        t=w.tags
        try: pts=[(nd.lon,nd.lat) for nd in w.nodes]
        except osmium.InvalidLocationError: return
        if not any(inb(*p) for p in pts): return
        if t.get('natural')=='coastline': s.coast.append(dict(id=w.id,pts=pts))
        elif t.get('highway') in ('motorway','trunk'): s.roads.append(dict(id=w.id,hw=t.get('highway'),ref=t.get('ref',''),name=t.get('name:en',t.get('name','')),pts=pts))
        nm=' '.join(t.get(k,'') for k in ('name','name:en'))
        if pat.search(nm) and not t.get('highway'):
            lo=sum(p[0] for p in pts)/len(pts); la=sum(p[1] for p in pts)/len(pts)
            s.hits.append(dict(t='way',id=w.id,lat=la,lon=lo,tags=dict(t)))
h=H(); h.apply_file(sys.argv[1],locations=True,idx='flex_mem')
json.dump(dict(coast=h.coast,roads=h.roads,hits=h.hits),open('osm-dubai.json','w'))
print(len(h.coast),len(h.roads),len(h.hits))
