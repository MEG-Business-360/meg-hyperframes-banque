import json,re,sys
S,B=sys.argv[1],sys.argv[2]
orig=open(B+'/outro-whatsapp-dss-v2.html').read()
wa=re.search(r'hf-owa-wa-logo-p" d="([^"]+)"',orig).group(1)
pin=re.search(r'hf-owa-pin-p" d="([^"]+)"',orig).group(1)
c=json.load(open(S+'/carte-svg.json'))
src=open(S+'/gabarit.src.html').read()
src=src.replace('data-hf-id="hf-owa-pin" id="owa-pin"','data-hf-id="hf-owa-pin-carte" id="owa-pin"')
k=c['cadre']
for a,b in [('@WA@',wa),('@PIN@',pin),('@TERRE@',c['terre']),('@ROUTES@',c['routes']),('@LON0@',repr(k['lon0'])),('@LON1@',repr(k['lon1'])),('@LAT0@',repr(k['lat0'])),('@LAT1@',repr(k['lat1']))]:
    src=src.replace(a,b)
assert '@' not in re.sub(r'@(font-face|media)','',src).replace('© ','') or True
left=re.findall(r'@[A-Z0-9]+@',src); assert not left,left
open(B+'/outro-whatsapp-dss-v2.html','w').write(src)
ids=re.findall(r'data-hf-id="([^"]+)"',src); dup={i for i in ids if ids.count(i)>1}; print('dups',dup, 'taille',len(src))
