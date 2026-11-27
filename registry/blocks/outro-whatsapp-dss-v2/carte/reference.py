# Reference : tuiles OSM standard (z11), reprojetees dans le cadre equirectangulaire de la carte, contour de notre terre et lieux par-dessus.
import json, math, sys, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
c=json.load(open('carte-svg.json'))['cadre']; Z=12
def tile_xy(lo,la):
    n=2**Z; x=(lo+180)/360*n; y=(1-math.asinh(math.tan(math.radians(la)))/math.pi)/2*n; return x,y
x0,y1=tile_xy(c['lon0'],c['lat0']); x1,y0=tile_xy(c['lon1'],c['lat1'])
tiles={}
for tx in range(int(x0),int(x1)+1):
    for ty in range(int(y0),int(y1)+1):
        p=Path(f'tuiles/{Z}-{tx}-{ty}.png')
        if not p.exists(): subprocess.run(['curl','-s','-m','30','-A','meg-carte-outro/1.0 (verification ponctuelle)','-o',str(p),f'https://tile.openstreetmap.org/{Z}/{tx}/{ty}.png'],check=True)
        tiles[(tx,ty)]=Image.open(p).convert('RGB')
W,H=c['w'],c['h']; out=Image.new('RGB',(W,H))
px=out.load()
for j in range(H):
    la=c['lat1']-(j+.5)/H*(c['lat1']-c['lat0'])
    for i in range(W):
        lo=c['lon0']+(i+.5)/W*(c['lon1']-c['lon0'])
        x,y=tile_xy(lo,la); t=tiles[(int(x),int(y))]
        px[i,j]=t.getpixel((min(255,int((x%1)*256)),min(255,int((y%1)*256))))
out.save('reference-osm.png'); print('ok',len(tiles))
